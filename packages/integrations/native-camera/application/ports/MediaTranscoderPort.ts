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
}
