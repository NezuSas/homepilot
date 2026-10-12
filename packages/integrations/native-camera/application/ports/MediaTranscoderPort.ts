import type * as http from 'http';

export interface NativeCameraRtspEndpoint {
  readonly host: string;
  readonly rtspPort: number;
  readonly rtspPath: string;
  readonly username: string;
  readonly password: string;
}

export interface NativeCameraHlsRuntimeHandle {
  readonly directory: string;
}

/** Why a camera did not hand over a frame. Stable codes; the application layer words them for a person. */
export type FrameCaptureFailure = 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONNECTION_REFUSED' | 'UNREACHABLE' | 'TIMEOUT' | 'NO_VIDEO' | 'FAILED';

export type FrameCaptureResult =
  | { readonly ok: true; readonly jpeg: Buffer; readonly width: number | null; readonly height: number | null; readonly codec: string | null }
  | { readonly ok: false; readonly reason: FrameCaptureFailure };

/**
 * Transcodes a native camera's RTSP feed into browser-consumable formats
 * (snapshot JPEG, MJPEG stream, HLS). Implemented by spawning `ffmpeg` in
 * infrastructure; the application layer never knows it's a child process.
 */
export interface MediaTranscoderPort {
  ensureHlsRuntime(deviceId: string, endpoint: NativeCameraRtspEndpoint): Promise<NativeCameraHlsRuntimeHandle>;
  stopHlsRuntime(deviceId: string): void;
  streamSnapshot(endpoint: NativeCameraRtspEndpoint, res: http.ServerResponse): void;
  streamMjpeg(endpoint: NativeCameraRtspEndpoint, res: http.ServerResponse): void;
  /** Opens the stream, grabs one frame and reports it, or why it could not. Never persists anything. */
  captureFrame(endpoint: NativeCameraRtspEndpoint, timeoutMs?: number): Promise<FrameCaptureResult>;
}
