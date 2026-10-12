import type { NativeCameraRtspEndpoint } from '../application/ports/MediaTranscoderPort';

/** The RTSP address ffmpeg opens; credentials already embedded in the path (some ONVIF cameras return them) are kept as they are. */
export function buildRtspUrl(endpoint: NativeCameraRtspEndpoint): string {
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
