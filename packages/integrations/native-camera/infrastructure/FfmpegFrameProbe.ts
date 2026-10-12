import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import type { FrameCaptureFailure, FrameCaptureResult, NativeCameraRtspEndpoint } from '../application/ports/MediaTranscoderPort';
import { buildRtspUrl } from './rtspUrl';

export const FRAME_PROBE_TIMEOUT_MS = 12_000;
const MAX_FRAME_BYTES = 3 * 1024 * 1024;
const MAX_LOG_CHARS = 64 * 1024;

export type SpawnFfmpeg = (args: string[]) => ChildProcessWithoutNullStreams;

/**
 * Reads ffmpeg's log to say why a camera did not answer. The log can contain the camera address with its
 * credentials, so it is only inspected here and never returned or written anywhere.
 */
export function classifyFfmpegOutput(log: string): FrameCaptureFailure {
  const text = log.toLowerCase();
  if (/\b(401|403)\b.*(unauthorized|forbidden)|unauthorized|authorization required|forbidden/.test(text)) return 'UNAUTHORIZED';
  if (/404 not found|\bnot found\b/.test(text)) return 'NOT_FOUND';
  if (/connection refused/.test(text)) return 'CONNECTION_REFUSED';
  if (/no route to host|network is unreachable|connection timed out|name or service not known|could not resolve|failed to resolve|host is down/.test(text)) return 'UNREACHABLE';
  if (/invalid data found|could not find codec parameters|unsupported codec|no video|does not contain any stream|unspecified pixel format/.test(text)) return 'NO_VIDEO';
  return 'FAILED';
}

/** Codec and resolution from the "Stream #0:0: Video: h264 (High), yuv420p, 1920x1080 ..." line of ffmpeg's log. */
export function readStreamDetails(log: string): { codec: string | null; width: number | null; height: number | null } {
  const video = log.match(/Video:\s*([A-Za-z0-9_]+)[^\n]*?,\s*(\d{2,5})x(\d{2,5})/);
  if (video) return { codec: video[1]!.toLowerCase(), width: Number(video[2]), height: Number(video[3]) };
  const codecOnly = log.match(/Video:\s*([A-Za-z0-9_]+)/);
  return { codec: codecOnly ? codecOnly[1]!.toLowerCase() : null, width: null, height: null };
}

/** Opens the camera's RTSP stream with ffmpeg and returns one JPEG frame, or the reason it could not. */
export function captureRtspFrame(
  endpoint: NativeCameraRtspEndpoint,
  timeoutMs: number = FRAME_PROBE_TIMEOUT_MS,
  spawnFfmpeg: SpawnFfmpeg = (args) => spawn('ffmpeg', args),
): Promise<FrameCaptureResult> {
  return new Promise((resolve) => {
    const frames: Buffer[] = [];
    let frameBytes = 0;
    let log = '';
    let settled = false;
    let timedOut = false;

    const child = spawnFfmpeg([
      '-hide_banner', '-loglevel', 'info', '-rtsp_transport', 'tcp', '-i', buildRtspUrl(endpoint),
      '-an', '-frames:v', '1', '-q:v', '4', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1',
    ]);

    const finish = (result: FrameCaptureResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      frameBytes += chunk.length;
      if (frameBytes > MAX_FRAME_BYTES) { child.kill('SIGKILL'); return; }
      frames.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (log.length < MAX_LOG_CHARS) log += chunk.toString('utf8');
    });
    child.on('error', () => finish({ ok: false, reason: 'FAILED' }));
    child.on('close', () => {
      const jpeg = Buffer.concat(frames);
      const isJpeg = jpeg.length > 2 && jpeg[0] === 0xff && jpeg[1] === 0xd8;
      if (isJpeg && frameBytes <= MAX_FRAME_BYTES) {
        finish({ ok: true, jpeg, ...readStreamDetails(log) });
        return;
      }
      finish({ ok: false, reason: timedOut ? 'TIMEOUT' : classifyFfmpegOutput(log) });
    });
  });
}
