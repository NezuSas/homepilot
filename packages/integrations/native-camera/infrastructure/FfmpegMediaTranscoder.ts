import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { MediaTranscoderPort, NativeCameraRtspEndpoint, NativeCameraHlsRuntimeHandle } from '../application/ports/MediaTranscoderPort';

const NATIVE_CAMERA_HLS_ROOT = path.join(os.tmpdir(), 'homepilot-native-cameras');

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

function buildRtspUrl(endpoint: NativeCameraRtspEndpoint): string {
  const rtspPath = endpoint.rtspPath.startsWith('/') ? endpoint.rtspPath : `/${endpoint.rtspPath}`;
  const hasEmbeddedCreds = rtspPath.toLowerCase().includes('username=') ||
    rtspPath.toLowerCase().includes('password=') ||
    rtspPath.toLowerCase().includes('user=') ||
    rtspPath.toLowerCase().includes('pwd=');
  if (hasEmbeddedCreds) {
    return `rtsp://${endpoint.host}:${endpoint.rtspPort}${rtspPath}`;
  }
  const username = encodeURIComponent(endpoint.username);
  const password = encodeURIComponent(endpoint.password);
  return `rtsp://${username}:${password}@${endpoint.host}:${endpoint.rtspPort}${rtspPath}`;
}

/**
 * Transcodes native camera RTSP feeds to browser-consumable formats by
 * spawning `ffmpeg` child processes. Moved verbatim from the former
 * `CameraRoutes.ts` native-camera branch (Phase 1 package extraction, no
 * behaviour change).
 */
export class FfmpegMediaTranscoder implements MediaTranscoderPort {
  private readonly runtimes = new Map<string, NativeHlsRuntime>();
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
    const directory = await this.spawnRuntime(deviceId, endpoint);
    return { directory };
  }

  public stopHlsRuntime(deviceId: string): void {
    const runtime = this.runtimes.get(deviceId);
    if (!runtime) return;
    clearInterval(runtime.healthTimer);
    this.runtimes.delete(deviceId);
    void this.terminateProcess(runtime.process);
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

  private async spawnRuntime(deviceId: string, endpoint: NativeCameraRtspEndpoint): Promise<string> {
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
      '-i',
      buildRtspUrl(endpoint),
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-pix_fmt',
      'yuv420p',
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

    let ffmpegStderr = '';
    ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
      ffmpegStderr += chunk.toString();
    });

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

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    });

    ffmpegProcess.stdout.pipe(res);
    ffmpegProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg snapshot exit code ${code}`);
      }
    });
  }

  // Fragmented MP4 pushed straight to the response as ffmpeg produces it,
  // fed into the browser via MediaSource. No HLS playlist/segment-close
  // latency: a viewer only waits for encode + network time (~1-2s), and it
  // travels over plain HTTP so it works through the same reverse
  // proxy/tunnel as everything else (no WebRTC/ICE/UDP required).
  public streamLive(endpoint: NativeCameraRtspEndpoint, res: http.ServerResponse): void {
    const rtspUrl = buildRtspUrl(endpoint);
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
      '-i',
      rtspUrl,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '15',
      '-g',
      '15',
      '-keyint_min',
      '15',
      '-sc_threshold',
      '0',
      '-f',
      'mp4',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      '-frag_duration',
      '200000',
      '-max_muxing_queue_size',
      '1024',
      '-',
    ]);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store, max-age=0',
    });

    ffmpegProcess.stdout.pipe(res);

    let ffmpegStderr = '';
    ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
      ffmpegStderr += chunk.toString();
    });

    // No data-flow watchdog here on purpose: Node pauses the piped stdout
    // Readable (no 'data' events at all, for any listener) whenever `res`
    // applies backpressure — e.g. a slow/remote viewer through a tunnel —
    // which is completely normal and NOT a stalled ffmpeg process. A prior
    // version killed the process after 8s of "silence" that was actually
    // just backpressure, which forced a reconnect on every healthy viewer
    // roughly every 10s. A genuinely dead RTSP source is instead caught by
    // the client's own playback-stall detection, which aborts the fetch and
    // reaches the res 'close' handler below.
    ffmpegProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg live stream exit code ${code}: ${ffmpegStderr.slice(-300)}`);
      }
    });

    res.on('close', () => {
      void this.terminateProcess(ffmpegProcess);
    });
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
