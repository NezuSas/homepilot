import * as crypto from 'crypto';

/** Parte de la sesión HLS que necesita la reescritura del manifiesto. */
export interface HlsRewriteSession {
  readonly deviceId: string;
  readonly resourcesById: Map<string, string>;
  readonly resourceIdsByPath: Map<string, string>;
}

const MAX_HLS_RESOURCES_PER_SESSION = 1024;

/** Resuelve un URI del manifiesto contra la ruta actual, restringido a `/api/hls/` de Home Assistant. */
export function resolveHlsPath(currentPath: string, uri: string): string {
  const proxyOrigin = 'http://homeassistant.local';
  const resolved = new URL(uri, new URL(currentPath, proxyOrigin));
  if (resolved.origin !== proxyOrigin || !resolved.pathname.startsWith('/api/hls/')) {
    throw new Error('CAMERA_HLS_RESOURCE_INVALID');
  }
  return `${resolved.pathname}${resolved.search}`;
}

/** Reescribe cada URI del manifiesto HA a un recurso proxy opaco con el token de la sesión. */
export function rewriteHlsManifest(
  manifest: string,
  currentUpstreamPath: string,
  session: HlsRewriteSession,
  token: string,
): string {
  const rewriteUri = (uri: string): string => {
    if (!uri || uri.startsWith('data:')) return uri;
    const upstreamPath = resolveHlsPath(currentUpstreamPath, uri);
    let resourceId = session.resourceIdsByPath.get(upstreamPath);
    if (!resourceId) {
      if (session.resourcesById.size >= MAX_HLS_RESOURCES_PER_SESSION) throw new Error('CAMERA_HLS_RESOURCE_LIMIT');
      resourceId = crypto.randomBytes(12).toString('base64url');
      session.resourcesById.set(resourceId, upstreamPath);
      session.resourceIdsByPath.set(upstreamPath, resourceId);
    }
    return `/api/v1/devices/${encodeURIComponent(session.deviceId)}/camera/hls/resource/${resourceId}?token=${encodeURIComponent(token)}`;
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith('#')) return rewriteUri(trimmed);
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${rewriteUri(uri)}"`);
    })
    .join('\n');
}
