import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { NativeCameraSource } from '../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraService, NativeCameraServiceError } from '../../../packages/integrations/native-camera/application/NativeCameraService';
import { ApiRoutes } from './ApiRoutes';

function toNativeCameraDto(source: NativeCameraSource): Record<string, unknown> {
  return {
    deviceId: source.deviceId,
    homeId: source.homeId,
    sourceType: source.sourceType,
    name: source.name,
    host: source.host,
    onvifPort: source.onvifPort,
    rtspPort: source.rtspPort,
    // password is intentionally omitted from API responses
    maskedPassword: source.password.length > 0 ? '••••••••' : '',
    rtspPath: source.rtspPath,
    enabled: source.enabled,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

const ERROR_STATUS: Record<NativeCameraServiceError['kind'], number> = {
  VALIDATION_ERROR: 400,
  HOME_NOT_FOUND: 404,
  CAMERA_CONNECTION_FAILED: 400,
  NATIVE_CAMERA_ALREADY_EXISTS: 409,
  CAMERA_NOT_FOUND: 404,
};

export class NativeCameraRoutes extends ApiRoutes {
  constructor(private readonly nativeCameraService: NativeCameraService) {
    super();
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    // GET /api/v1/native-cameras/discover
    if (method === 'GET' && pathname === '/api/v1/native-cameras/discover') {
      await this.discoverCameras(req, res, container);
      return true;
    }

    // GET /api/v1/native-cameras?homeId=<id>
    if (method === 'GET' && pathname === '/api/v1/native-cameras') {
      await this.listNativeCameras(req, res, container);
      return true;
    }

    // POST /api/v1/native-cameras
    if (method === 'POST' && pathname === '/api/v1/native-cameras') {
      await this.createNativeCamera(req, res, container);
      return true;
    }

    // PUT /api/v1/native-cameras/:deviceId
    const putMatch = method === 'PUT'
      ? pathname.match(/^\/api\/v1\/native-cameras\/([^/]+)$/)
      : null;
    if (putMatch) {
      await this.updateNativeCamera(req, res, container, decodeURIComponent(putMatch[1]));
      return true;
    }

    // DELETE /api/v1/native-cameras/:deviceId
    const deleteMatch = method === 'DELETE'
      ? pathname.match(/^\/api\/v1\/native-cameras\/([^/]+)$/)
      : null;
    if (deleteMatch) {
      await this.deleteNativeCamera(req, res, container, decodeURIComponent(deleteMatch[1]));
      return true;
    }

    return false;
  }

  private sendServiceError(res: http.ServerResponse, error: NativeCameraServiceError): void {
    this.sendError(res, ERROR_STATUS[error.kind], error.kind, error.message);
  }

  private async discoverCameras(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const devices = await this.nativeCameraService.discover();
      this.sendJson(res, { devices });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to discover cameras');
    }
  }

  private async listNativeCameras(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const url = new URL(req.url || '/api/v1/native-cameras', 'http://localhost');
      const homeId = url.searchParams.get('homeId');
      if (!homeId) {
        this.sendError(res, 400, 'MISSING_HOME_ID', 'homeId query parameter is required');
        return;
      }
      const rows = this.nativeCameraService.listByHome(homeId);

      this.sendJson(res, { cameras: rows.map(toNativeCameraDto) });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to list cameras');
    }
  }

  private async createNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const body = await this.parseBody<Parameters<NativeCameraService['create']>[0]>(req);
      const result = await this.nativeCameraService.create(body);
      if (!result.ok) {
        this.sendServiceError(res, result.error);
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ camera: toNativeCameraDto(result.value) }));
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to create camera');
    }
  }

  private async updateNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const body = await this.parseBody<Parameters<NativeCameraService['update']>[1]>(req);
      const result = await this.nativeCameraService.update(deviceId, body);
      if (!result.ok) {
        this.sendServiceError(res, result.error);
        return;
      }

      this.sendJson(res, { camera: toNativeCameraDto(result.value) });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to update camera');
    }
  }

  private async deleteNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const result = await this.nativeCameraService.delete(deviceId);
      if (!result.ok) {
        this.sendServiceError(res, result.error);
        return;
      }

      res.writeHead(204);
      res.end();
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to delete camera');
    }
  }
}
