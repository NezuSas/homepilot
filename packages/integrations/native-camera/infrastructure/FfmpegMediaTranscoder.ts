import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { FrameCaptureResult, MediaTranscoderPort, NativeCameraRtspEndpoint, NativeCameraHlsRuntimeHandle } from '../application/ports/MediaTranscoderPort';
import { buildRtspUrl } from './rtspUrl';
import { captureRtspFrame } from './FfmpegFrameProbe';

const NATIVE_CAMERA_HLS_ROOT = path.join(os.tmpdir(), 'homepilot-native-cameras');
const MAX_FFMPEG_LOG_CHARS = 64 * 1024;

/**
 * A ChildProcess that emits 'error' with no listener throws, which ends the Edge process. ffmpeg does emit it:
 * ENOENT when the binary is missing from the image, EAGAIN when the appliance cannot fork under memory
 * pressure. The spawn failure is logged and the stream simply yields nothing.
 */
function attachSpawnFailureHandler(child: ChildProcessWithoutNullStreams, label: string): void {
  child.on('error', (error: Error) => {
    console.error(`[FfmpegMediaTranscoder] no se pudo ejecutar ffmpeg (${label}): ${error.message}`);
  });
}

/**
 * Keeps a stderr nobody reads from filling the OS pipe buffer, which would block ffmpeg mid-frame and
 * freeze the video with no error anywhere. Consuming the data is what drains it.
 */
function drainStderr(child: ChildProcessWithoutNullStreams): void {
  child.stderr.on('data', () => undefined);
}

interface NativeHlsRuntime {
  process: ChildProcessWithoutNullStreams;
  readonly directory: string;
  startedAt: number;
  readonly endpoint: NativeCameraRtspEndpoint;
  healthTimer: ReturnType<typeof setInterval>;
}

// ffmpeg is configured to emit a new HLS segment every ~1s (see -hls_time
// below). If index.m3u8 goes 15x that long without being rewritten, the RTSP
// source has stalled (silently, without ffmpeg exiting) and playback would
// otherwise freeze on the last segment forever.
const STALE_SEGMENT_THRESHOLD_MS = 15_000;
const HEALTH_CHECK_INTERVAL_MS = 5_000;

/**
 * Transcodes native camera RTSP feeds to browser-consumable formats by
 * spawning `ffmpeg` child processes. Moved verbatim from the former
 * `CameraRoutes.ts` native-camera branch (Phase 1 package extraction, no
 * behaviour change).
 */
export class FfmpegMediaTranscoder implements MediaTranscoderPort {
  private readonly runtimes = new Map<string, NativeHlsRuntime>();
  private readonly startsInFlight = new Map<string, Promise<string>>();
  private readonly stopsInFlight = new Map<string, Promise<void>>();
  private readonly restartsInFlight = new Set<string>();

  public async ensureHlsRuntime(deviceId: string, endpoint: NativeCameraRtspEndpoint): Promise<NativeCameraHlsRuntimeHandle> {
    const existing = this.runtimes.get(deviceId);
    const indexPath = existing ? path.join(existing.directory, 'index.m3u8') : '';
    if (existing && !existing.process.killed && fs.existsSync(indexPath) && !this.isSegmentOutputStale(indexPath)) {
      return { directory: existing.directory };
    }

    // spawnRuntime looks up and properly awaits termination of any existing
    // runtime for this device itself — don't race it by tearing the old one
    // down here first (stopHlsRuntime's process kill is fire-and-forget).
    let start = this.startsInFlight.get(deviceId);
    if (!start) {
      start = this.spawnRuntime(deviceId, endpoint);
      this.startsInFlight.set(deviceId, start);
      void start.finally(() => {
        if (this.startsInFlight.get(deviceId) === start) this.startsInFlight.delete(deviceId);
      }).catch(() => undefined);
    }
    const directory = await start;
    return { directory };
  }

  public stopHlsRuntime(deviceId: string): void {
    const runtime = this.runtimes.get(deviceId);
    if (!runtime) return;
    clearInterval(runtime.healthTimer);
    this.runtimes.delete(deviceId);
    const stopping = this.terminateProcess(runtime.process);
    this.stopsInFlight.set(deviceId, stopping);
    void stopping.finally(() => {
      if (this.stopsInFlight.get(deviceId) === stopping) this.stopsInFlight.delete(deviceId);
    });
  }

  // ffmpeg can be blocked in a network read against an unresponsive RTSP
  // source and ignore SIGTERM indefinitely. Reusing the same HLS directory
  // (same index.m3u8/segment filenames) before that old process is actually
  // gone lets it and the freshly spawned one write concurrently, corrupting
  // the manifest in a way no client reload can recover from. SIGKILL after a
  // grace period guarantees the old writer is gone before we touch the files.
  private terminateProcess(proc: ChildProcessWithoutNullStreams, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      if (proc.killed || proc.exitCode !== null) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(sigkillTimer);
        resolve();
      };
      proc.once('exit', finish);
      proc.kill('SIGTERM');
      const sigkillTimer = setTimeout(() => {
        if (settled) return;
        proc.kill('SIGKILL');
        setTimeout(finish, 500);
      }, timeoutMs);
    });
  }

  private isSegmentOutputStale(indexPath: string): boolean {
    try {
      const { mtimeMs } = fs.statSync(indexPath);
      return Date.now() - mtimeMs > STALE_SEGMENT_THRESHOLD_MS;
    } catch {
      return true;
    }
  }

  private startHealthWatchdog(deviceId: string): ReturnType<typeof setInterval> {
    return setInterval(() => {
      if (this.restartsInFlight.has(deviceId)) return;
      const runtime = this.runtimes.get(deviceId);
      if (!runtime) return;

      const indexPath = path.join(runtime.directory, 'index.m3u8');
      const isDead = runtime.process.killed || runtime.process.exitCode !== null;
      const isStale = this.isSegmentOutputStale(indexPath);
      if (!isDead && !isStale) return;

      console.warn(`[FfmpegMediaTranscoder] Native camera ${deviceId} stream ${isDead ? 'died' : 'stalled (no new segments)'}, restarting ffmpeg automatically.`);
      this.restartsInFlight.add(deviceId);
      void this.spawnRuntime(deviceId, runtime.endpoint)
        .catch((err) => console.error(`[FfmpegMediaTranscoder] Auto-restart failed for device ${deviceId}:`, err))
        .finally(() => this.restartsInFlight.delete(deviceId));
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private async spawnRuntime(deviceId: string, endpoint: NativeCameraRtspEndpoint, encoder?: 'software' | 'vaapi'): Promise<string> {
    const stopping = this.stopsInFlight.get(deviceId);
    if (stopping) await stopping;
    const previous = this.runtimes.get(deviceId);
    if (previous) {
      clearInterval(previous.healthTimer);
      this.runtimes.delete(deviceId);
      await this.terminateProcess(previous.process);
    }

    const directory = path.join(NATIVE_CAMERA_HLS_ROOT, deviceId);
    fs.mkdirSync(directory, { recursive: true });
    for (const file of fs.readdirSync(directory)) {
      fs.unlinkSync(path.join(directory, file));
    }

    const useVaapi = (encoder ?? (process.env.HOMEPILOT_CAMERA_HLS_ENCODER === 'auto' && fs.existsSync('/dev/dri/renderD128') ? 'vaapi' : 'software')) === 'vaapi';
    const ffmpegProcess = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-probesize',
      '32768',
      '-analyzeduration',
      '100000',
      ...(useVaapi ? ['-vaapi_device', '/dev/dri/renderD128'] : []),
      '-i',
      buildRtspUrl(endpoint),
      '-an',
      ...(useVaapi ? ['-vf', 'format=nv12,hwupload'] : []),
      '-c:v',
      useVaapi ? 'h264_vaapi' : 'libx264',
      ...(useVaapi ? ['-qp', '24'] : ['-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-level', '3.1', '-pix_fmt', 'yuv420p']),
      '-r',
      '15',
      '-g',
      '15',
      '-keyint_min',
      '15',
      '-sc_threshold',
      '0',
      '-f',
      'hls',
      '-hls_time',
      '1',
      '-hls_list_size',
      '8',
      '-hls_flags',
      'delete_segments+independent_segments+program_date_time',
      '-hls_segment_filename',
      path.join(directory, 'segment-%05d.ts'),
      path.join(directory, 'index.m3u8'),
    ]);

    // An always-on runtime lives for weeks and a camera with clock drift or packet loss warns continuously,
    // so the buffer is capped: only the tail is ever read, and the rest would be pure heap growth.
    let ffmpegStderr = '';
    ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
      if (ffmpegStderr.length < MAX_FFMPEG_LOG_CHARS) ffmpegStderr += chunk.toString();
    });
    attachSpawnFailureHandler(ffmpegProcess, `HLS device ${deviceId}`);

    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`[FfmpegMediaTranscoder] ffmpeg process for device ${deviceId} exited with code ${code} and signal ${signal}`);
      if (code !== 0 && code !== null) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg stderr: ${ffmpegStderr.slice(-500)}`);
      }
      const current = this.runtimes.get(deviceId);
      if (current?.process === ffmpegProcess) {
        clearInterval(current.healthTimer);
        this.runtimes.delete(deviceId);
      }
    });

    try {
      await this.waitForFile(path.join(directory, 'index.m3u8'), 8000);
    } catch (err) {
      await this.terminateProcess(ffmpegProcess);
      if (useVaapi) {
        console.warn(`[FfmpegMediaTranscoder] VAAPI unavailable for device ${deviceId}; falling back to software encoding.`);
        return this.spawnRuntime(deviceId, endpoint, 'software');
      }
      if (ffmpegStderr.includes('401') || ffmpegStderr.toLowerCase().includes('unauthorized') || ffmpegStderr.toLowerCase().includes('authorization failed')) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg 401 Unauthorized for device ${deviceId}. Check camera credentials.`);
        throw new Error('NATIVE_CAMERA_AUTH_FAILED');
      }
      console.error(`[FfmpegMediaTranscoder] ffmpeg failed for device ${deviceId}: ${ffmpegStderr.slice(-300)}`);
      throw err;
    }

    // Only start monitoring once the stream has actually produced output.
    // Registering the watchdog earlier let it observe the pre-existing
    // index.m3u8 as "stale" during this same startup window and trigger a
    // second concurrent restart before this attempt had even finished.
    const healthTimer = this.startHealthWatchdog(deviceId);
    this.runtimes.set(deviceId, { process: ffmpegProcess, directory, startedAt: Date.now(), endpoint, healthTimer });
    return directory;
  }

  public streamSnapshot(endpoint: NativeCameraRtspEndpoint, res: http.ServerResponse): void {
    const rtspUrl = buildRtspUrl(endpoint);
    const ffmpegProcess = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-vframes',
      '1',
      '-f',
      'image2',
      '-',
    ]);

    attachSpawnFailureHandler(ffmpegProcess, 'snapshot');
    drainStderr(ffmpegProcess);

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    });

    ffmpegProcess.stdout.pipe(res);
    res.on('close', () => ffmpegProcess.kill('SIGTERM'));
    ffmpegProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg snapshot exit code ${code}`);
      }
    });
  }

  public captureFrame(endpoint: NativeCameraRtspEndpoint, timeoutMs?: number): Promise<FrameCaptureResult> {
    return captureRtspFrame(endpoint, timeoutMs);
  }

  public streamMjpeg(endpoint: NativeCameraRtspEndpoint, res: http.ServerResponse): void {
    const rtspUrl = buildRtspUrl(endpoint);
    const ffmpegProcess = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-c:v',
      'mjpeg',
      '-f',
      'mpjpeg',
      '-',
    ]);

    attachSpawnFailureHandler(ffmpegProcess, 'MJPEG');
    drainStderr(ffmpegProcess);

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpeg',
      'Cache-Control': 'no-store, max-age=0',
    });

    ffmpegProcess.stdout.pipe(res);
    res.on('close', () => {
      ffmpegProcess.kill('SIGTERM');
    });
  }

  private async waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('.ts')) return;
        } catch {
          // Ignore read errors during concurrent write
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('NATIVE_CAMERA_STREAM_TIMEOUT');
  }
}
