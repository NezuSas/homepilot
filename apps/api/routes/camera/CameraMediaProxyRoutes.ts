import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import type { NativeCameraSourceRepository } from '../../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraStreamingService } from '../../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { ApiRoutes } from '../ApiRoutes';
import { verifyCameraProxyToken } from './cameraProxyToken';
import { CameraMediaKind, pathnameFallback, resolveCameraEntityId } from './cameraEntity';
import { pumpUpstreamToResponse } from './pumpUpstreamToResponse';

/**
 * GET /api/v1/devices/:id/camera/(snapshot|stream) — token-authenticated media proxy
 * for Home Assistant cameras and native cameras.
 */
export class CameraMediaProxyRoutes extends ApiRoutes {
  constructor(
    private readonly nativeCameraSourceRepository?: NativeCameraSourceRepository,
    private readonly nativeCameraStreamingService?: NativeCameraStreamingService,
  ) {
    super();
  }

  private static match(pathname: string, method: string): RegExpMatchArray | null {
    return method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/(snapshot|stream)$/)
      : null;
  }

  /** Comprobación síncrona para que CameraRoutes despache sin ceder el turno antes de tiempo. */
  matches(pathname: string, method: string): boolean {
    return CameraMediaProxyRoutes.match(pathname, method) !== null;
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const mediaMatch = CameraMediaProxyRoutes.match(pathname, method);

    if (!mediaMatch) return false;
    await this.proxyCameraMedia(req, res, container, mediaMatch[1], mediaMatch[2] as CameraMediaKind);
    return true;
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

    if (!verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
    const entityId = resolveCameraEntityId(device);
    if (!device || !entityId) {
      this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
      return;
    }

    if (device.integrationSource === 'native-camera') {
      const nativeSource = this.nativeCameraSourceRepository?.findByDeviceId(device.id) ?? null;
      if (!nativeSource || !nativeSource.enabled) {
        this.sendError(res, 409, 'CAMERA_UNAVAILABLE', 'Native camera is not configured');
        return;
      }
      if (kind === 'snapshot') {
        this.nativeCameraStreamingService!.streamSnapshot(nativeSource, res);
        return;
      }
      if (kind === 'stream') {
        this.nativeCameraStreamingService!.streamMjpeg(nativeSource, res);
        return;
      }
      this.sendError(res, 400, 'INVALID_MEDIA_KIND', `Unsupported media kind: ${kind}`);
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

      await pumpUpstreamToResponse(upstream.body, res);
      if (!res.destroyed) res.end();
    } catch (error: unknown) {
      if (abortController.signal.aborted || res.destroyed) return;
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }
}
