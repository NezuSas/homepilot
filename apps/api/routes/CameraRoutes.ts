import * as http from 'http';
import * as crypto from 'crypto';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ApiRoutes } from './ApiRoutes';

type CameraMediaKind = 'snapshot' | 'stream';

interface CameraSessionResponse {
  readonly snapshotPath: string;
  readonly streamPath: string;
  readonly hlsPath?: string;
}

interface CameraProxyTokenPayload {
  readonly deviceId: string;
  readonly expiresAt: number;
}

interface CameraHlsProxySession {
  readonly deviceId: string;
  readonly expiresAt: number;
  readonly masterPath: string;
  readonly resourcesById: Map<string, string>;
  readonly resourceIdsByPath: Map<string, string>;
}

const CAMERA_PROXY_TOKEN_TTL_MS = 5 * 60 * 1000;

export class CameraRoutes extends ApiRoutes {
  private readonly hlsSessions = new Map<string, CameraHlsProxySession>();

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const hlsMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/hls\/(master\.m3u8|resource\/([^/]+))$/)
      : null;

    if (hlsMatch) {
      await this.proxyCameraHls(req, res, container, hlsMatch[1], hlsMatch[3]);
      return true;
    }

    const mediaMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/(snapshot|stream)$/)
      : null;

    if (mediaMatch) {
      await this.proxyCameraMedia(req, res, container, mediaMatch[1], mediaMatch[2] as CameraMediaKind);
      return true;
    }

    const sessionMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/session$/)
      : null;

    if (!sessionMatch) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    try {
      const device = await container.repositories.deviceRepository.findDeviceById(sessionMatch[1]);
      const entityId = this.resolveCameraEntityId(device);
      if (!device || !entityId) {
        this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
        return true;
      }

      const state = await container.adapters.homeAssistantClient.getEntityState(entityId);
      if (!state || state.state === 'unavailable') {
        this.sendError(res, 409, 'CAMERA_UNAVAILABLE', `Camera ${entityId} is unavailable`);
        return true;
      }

      const encodedDeviceId = encodeURIComponent(device.id);
      const cameraProxyToken = this.createCameraProxyToken(device.id);
      const encodedToken = encodeURIComponent(cameraProxyToken);
      let hlsMasterPath: string | null = null;
      try {
        hlsMasterPath = await container.adapters.homeAssistantClient.getCameraHlsStreamPath(entityId);
      } catch {
        hlsMasterPath = null;
      }

      const response: CameraSessionResponse = {
        snapshotPath: `/api/v1/devices/${encodedDeviceId}/camera/snapshot?token=${encodedToken}`,
        streamPath: `/api/v1/devices/${encodedDeviceId}/camera/stream?token=${encodedToken}`,
        ...(hlsMasterPath
          ? { hlsPath: `/api/v1/devices/${encodedDeviceId}/camera/hls/master.m3u8?token=${encodedToken}` }
          : {}),
      };
      if (hlsMasterPath) this.registerHlsSession(cameraProxyToken, device.id, hlsMasterPath);
      this.sendJson(res, response);
    } catch (error: unknown) {
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera session failed');
    }

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
    if (!cameraProxyToken || !this.verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const session = this.hlsSessions.get(cameraProxyToken);
    if (!session || session.deviceId !== deviceId || session.expiresAt <= Date.now()) {
      this.hlsSessions.delete(cameraProxyToken);
      this.sendError(res, 401, 'CAMERA_SESSION_EXPIRED', 'Camera HLS session expired');
      return;
    }

    const upstreamPath = resourceId ? session.resourcesById.get(resourceId) : session.masterPath;
    if (!upstreamPath) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
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
        const rewrittenManifest = this.rewriteHlsManifest(
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
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera HLS proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }

  private async proxyCameraMedia(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
    kind: CameraMediaKind,
  ): Promise<void> {
    const requestUrl = new URL(req.url || pathnameFallback(kind, deviceId), 'http://localhost');
    const cameraProxyToken = requestUrl.searchParams.get('token');
    if (!cameraProxyToken) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Missing camera access token');
      return;
    }

    if (!this.verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
    const entityId = this.resolveCameraEntityId(device);
    if (!entityId) {
      this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
      return;
    }

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);

    try {
      const upstream = await container.adapters.homeAssistantClient.getCameraMedia(
        entityId,
        kind,
        abortController.signal,
      );

      if (!upstream.ok || !upstream.body) {
        this.sendError(
          res,
          upstream.status === 401 || upstream.status === 403 ? 401 : 502,
          upstream.status === 401 || upstream.status === 403 ? 'UNAUTHORIZED' : 'CAMERA_MEDIA_ERROR',
          `Home Assistant camera response ${upstream.status}`,
        );
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.startsWith('image/') && !contentType.startsWith('multipart/x-mixed-replace')) {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', `Unexpected camera content type: ${contentType}`);
        return;
      }

      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentType,
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
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }

  private resolveCameraEntityId(device: Device | null): string | null {
    if (!device?.externalId.startsWith('ha:camera.')) return null;
    return device.externalId.slice(3);
  }

  private createCameraProxyToken(deviceId: string): string {
    const payload: CameraProxyTokenPayload = {
      deviceId,
      expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signCameraProxyPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private registerHlsSession(token: string, deviceId: string, masterPath: string): void {
    this.removeExpiredHlsSessions();
    this.hlsSessions.set(token, {
      deviceId,
      expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
      masterPath,
      resourcesById: new Map<string, string>(),
      resourceIdsByPath: new Map<string, string>(),
    });
  }

  private rewriteHlsManifest(
    manifest: string,
    currentUpstreamPath: string,
    session: CameraHlsProxySession,
    token: string,
  ): string {
    const rewriteUri = (uri: string): string => {
      if (!uri || uri.startsWith('data:')) return uri;
      const upstreamPath = this.resolveHlsPath(currentUpstreamPath, uri);
      let resourceId = session.resourceIdsByPath.get(upstreamPath);
      if (!resourceId) {
        if (session.resourcesById.size >= 1024) throw new Error('CAMERA_HLS_RESOURCE_LIMIT');
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

  private resolveHlsPath(currentPath: string, uri: string): string {
    const proxyOrigin = 'http://homeassistant.local';
    const resolved = new URL(uri, new URL(currentPath, proxyOrigin));
    if (resolved.origin !== proxyOrigin || !resolved.pathname.startsWith('/api/hls/')) {
      throw new Error('CAMERA_HLS_RESOURCE_INVALID');
    }
    return `${resolved.pathname}${resolved.search}`;
  }

  private removeExpiredHlsSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.hlsSessions) {
      if (session.expiresAt <= now) this.hlsSessions.delete(token);
    }
  }

  private verifyCameraProxyToken(token: string, deviceId: string): boolean {
    const [encodedPayload, providedSignature] = token.split('.');
    if (!encodedPayload || !providedSignature) return false;

    const expectedSignature = this.signCameraProxyPayload(encodedPayload);
    if (!this.tokensMatch(providedSignature, expectedSignature)) return false;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CameraProxyTokenPayload;
      return payload.deviceId === deviceId && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
    } catch {
      return false;
    }
  }

  private signCameraProxyPayload(encodedPayload: string): string {
    const secret = process.env.CAMERA_PROXY_SIGNING_SECRET
      || process.env.HOME_ASSISTANT_TOKEN
      || 'homepilot-camera-proxy-development-secret';
    return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  }

  private tokensMatch(providedToken: string, expectedToken: string): boolean {
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  }
}

function pathnameFallback(kind: CameraMediaKind, deviceId: string): string {
  return `/api/v1/devices/${encodeURIComponent(deviceId)}/camera/${kind}`;
}
