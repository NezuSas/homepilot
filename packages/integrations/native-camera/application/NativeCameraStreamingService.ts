import type * as http from 'http';
import type { NativeCameraSource } from '../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { MediaTranscoderPort, NativeCameraHlsRuntimeHandle, NativeCameraRtspEndpoint } from './ports/MediaTranscoderPort';

function toRtspEndpoint(source: NativeCameraSource): NativeCameraRtspEndpoint {
  return {
    host: source.host,
    rtspPort: source.rtspPort,
    rtspPath: source.rtspPath,
    username: source.username,
    password: source.password
  };
}

/**
 * Orchestrates media delivery for native camera sources: HLS runtime
 * lifecycle, snapshot and MJPEG streaming. Extracted from the former
 * `CameraRoutes.ts` native-camera branch (Phase 1 package extraction, no
 * behaviour change) — the HTTP layer keeps only routing, auth, and the
 * signed-token/proxy-session bookkeeping shared with the Home Assistant path.
 */
export class NativeCameraStreamingService {
  constructor(private readonly transcoder: MediaTranscoderPort) {}

  public ensureHlsRuntime(deviceId: string, source: NativeCameraSource): Promise<NativeCameraHlsRuntimeHandle> {
    return this.transcoder.ensureHlsRuntime(deviceId, toRtspEndpoint(source));
  }

  public stopHlsRuntime(deviceId: string): void {
    this.transcoder.stopHlsRuntime(deviceId);
  }

  public streamSnapshot(source: NativeCameraSource, res: http.ServerResponse): void {
    this.transcoder.streamSnapshot(toRtspEndpoint(source), res);
  }

  public streamMjpeg(source: NativeCameraSource, res: http.ServerResponse): void {
    this.transcoder.streamMjpeg(toRtspEndpoint(source), res);
  }

  public streamLive(source: NativeCameraSource, res: http.ServerResponse): void {
    this.transcoder.streamLive(toRtspEndpoint(source), res);
  }
}
