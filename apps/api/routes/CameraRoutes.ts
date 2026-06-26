import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ApiRoutes } from './ApiRoutes';

type CameraMediaKind = 'snapshot' | 'stream';

interface CameraSessionResponse {
  readonly snapshotPath: string;
  readonly streamPath: string;
}

export class CameraRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
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

      const cameraAccessToken = this.extractCameraAccessToken(state.attributes.entity_picture);
      if (!cameraAccessToken) {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', `Camera ${entityId} has no entity access token`);
        return true;
      }

      const encodedDeviceId = encodeURIComponent(device.id);
      const encodedToken = encodeURIComponent(cameraAccessToken);
      const response: CameraSessionResponse = {
        snapshotPath: `/api/v1/devices/${encodedDeviceId}/camera/snapshot?token=${encodedToken}`,
        streamPath: `/api/v1/devices/${encodedDeviceId}/camera/stream?token=${encodedToken}`,
      };
      this.sendJson(res, response);
    } catch (error: unknown) {
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera session failed');
    }

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
    const cameraAccessToken = requestUrl.searchParams.get('token');
    if (!cameraAccessToken) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Missing camera access token');
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
        cameraAccessToken,
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

  private extractCameraAccessToken(entityPicture: unknown): string | null {
    if (typeof entityPicture !== 'string') return null;
    try {
      return new URL(entityPicture, 'http://homeassistant.local').searchParams.get('token');
    } catch {
      return null;
    }
  }
}

function pathnameFallback(kind: CameraMediaKind, deviceId: string): string {
  return `/api/v1/devices/${encodeURIComponent(deviceId)}/camera/${kind}`;
}
