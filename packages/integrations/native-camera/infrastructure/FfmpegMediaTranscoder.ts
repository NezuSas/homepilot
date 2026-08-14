import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { MediaTranscoderPort, NativeCameraRtspEndpoint, NativeCameraHlsRuntimeHandle } from '../application/ports/MediaTranscoderPort';

const NATIVE_CAMERA_HLS_ROOT = path.join(os.tmpdir(), 'homepilot-native-cameras');

interface NativeHlsRuntime {
  readonly process: ChildProcessWithoutNullStreams;
  readonly directory: string;
  readonly startedAt: number;
}

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

  public async ensureHlsRuntime(deviceId: string, endpoint: NativeCameraRtspEndpoint): Promise<NativeCameraHlsRuntimeHandle> {
    const existing = this.runtimes.get(deviceId);
    const indexPath = existing ? path.join(existing.directory, 'index.m3u8') : '';
    if (existing && !existing.process.killed && fs.existsSync(indexPath)) return { directory: existing.directory };

    if (existing) this.stopHlsRuntime(deviceId);

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
      '30',
      '-keyint_min',
      '30',
      '-sc_threshold',
      '0',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '6',
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
      if (current?.process === ffmpegProcess) this.runtimes.delete(deviceId);
    });

    this.runtimes.set(deviceId, { process: ffmpegProcess, directory, startedAt: Date.now() });
    try {
      await this.waitForFile(path.join(directory, 'index.m3u8'), 8000);
    } catch (err) {
      this.stopHlsRuntime(deviceId);
      if (ffmpegStderr.includes('401') || ffmpegStderr.toLowerCase().includes('unauthorized') || ffmpegStderr.toLowerCase().includes('authorization failed')) {
        console.error(`[FfmpegMediaTranscoder] ffmpeg 401 Unauthorized for device ${deviceId}. Check camera credentials.`);
        throw new Error('NATIVE_CAMERA_AUTH_FAILED');
      }
      console.error(`[FfmpegMediaTranscoder] ffmpeg failed for device ${deviceId}: ${ffmpegStderr.slice(-300)}`);
      throw err;
    }
    return { directory };
  }

  public stopHlsRuntime(deviceId: string): void {
    const runtime = this.runtimes.get(deviceId);
    if (!runtime) return;
    runtime.process.kill('SIGTERM');
    this.runtimes.delete(deviceId);
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
