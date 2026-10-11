import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { BootstrapContainer } from '../../../../bootstrap';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { CameraHlsProxySession, CameraHlsSessionStore } from './CameraHlsSessionStore';
import { CAMERA_PROXY_TOKEN_TTL_MS, verifyCameraProxyToken } from './cameraProxyToken';
import { pathnameFallback } from './cameraEntity';
import { rewriteHlsManifest } from './hlsManifest';

/**
 * GET /api/v1/devices/:id/camera/hls/(master.m3u8|resource/:resourceId) — token-authenticated
 * HLS proxy for Home Assistant cameras and the native-camera HLS runtime.
 */
export class CameraHlsProxyRoutes extends ApiRoutes {
  constructor(private readonly store: CameraHlsSessionStore) {
    super();
  }

  private static match(pathname: string, method: string): RegExpMatchArray | null {
    return method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/hls\/(master\.m3u8|resource\/([^/]+))$/)
      : null;
  }

  /** Comprobación síncrona para que CameraRoutes despache sin ceder el turno antes de tiempo. */
  matches(pathname: string, method: string): boolean {
    return CameraHlsProxyRoutes.match(pathname, method) !== null;
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const hlsMatch = CameraHlsProxyRoutes.match(pathname, method);

    if (!hlsMatch) return false;
    await this.proxyCameraHls(req, res, container, hlsMatch[1], hlsMatch[3]);
    return true;
  }

  private async proxyCameraHls(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
    resourceId?: string,
  ): Promise<void> {
    const requestUrl = new URL(req.url || pathnameFallback('stream', deviceId), 'http://localhost');
    const cameraProxyToken = requestUrl.searchParams.get('token');
    if (!cameraProxyToken || !verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const session = this.store.sessions.get(cameraProxyToken);
    if (!session || session.deviceId !== deviceId || session.expiresAt <= Date.now()) {
      this.store.sessions.delete(cameraProxyToken);
      this.sendError(res, 401, 'CAMERA_SESSION_EXPIRED', 'Camera HLS session expired');
      return;
    }

    // Sliding expiration: a camera feed actively being watched (manifest or
    // segment requests keep arriving) must never expire mid-stream. Only a
    // session left idle for the full TTL gets reaped by removeExpiredHlsSessions.
    session.expiresAt = Date.now() + CAMERA_PROXY_TOKEN_TTL_MS;
    session.lastAccessAt = Date.now();

    const upstreamPath = resourceId ? session.resourcesById.get(resourceId) : session.masterPath;
    if (!upstreamPath) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    if (session.source === 'native') {
      await this.serveNativeHlsResource(res, session, upstreamPath);
      return;
    }

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);

    try {
      const upstream = await container.adapters.homeAssistantClient.getCameraHlsMedia(
        upstreamPath,
        abortController.signal,
      );
      if (!upstream.ok || !upstream.body) {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', `Home Assistant HLS response ${upstream.status}`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const isManifest = upstreamPath.split('?')[0].endsWith('.m3u8')
        || contentType.includes('mpegurl')
        || contentType.includes('mpegURL');

      if (isManifest) {
        const manifest = await upstream.text();
        const rewrittenManifest = rewriteHlsManifest(
          manifest,
          upstreamPath,
          session,
          cameraProxyToken,
        );
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(rewrittenManifest);
        return;
      }

      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      };
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) headers['Content-Length'] = contentLength;
      res.writeHead(200, headers);

      const reader = upstream.body.getReader();
      while (!res.destroyed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(chunk.value);
      }
      if (!res.destroyed) res.end();
    } catch (error: unknown) {
      if (abortController.signal.aborted || res.destroyed) return;
      console.error('[CameraRoutes] proxyCameraHls critical error:', error);
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera HLS proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }

  async serveNativeHlsResource(
    res: http.ServerResponse,
    session: CameraHlsProxySession,
    filePath: string | undefined,
  ): Promise<void> {
    if (!filePath || !session.nativeDirectory) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    const resolvedFilePath = path.resolve(filePath);
    const resolvedDirectory = path.resolve(session.nativeDirectory);
    if (!resolvedFilePath.startsWith(resolvedDirectory) || !fs.existsSync(resolvedFilePath)) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    if (resolvedFilePath.endsWith('.m3u8')) {
      const manifest = fs.readFileSync(resolvedFilePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const resourceId = path.basename(trimmed);
          session.resourcesById.set(resourceId, path.join(resolvedDirectory, resourceId));
          return `/api/v1/devices/${encodeURIComponent(session.deviceId)}/camera/hls/resource/${encodeURIComponent(resourceId)}?token=${this.store.currentTokenForSession(session)}`;
        })
        .join('\n');
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(manifest);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(resolvedFilePath).pipe(res);
  }
}
