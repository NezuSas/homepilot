import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AndroidDisplayBridgeError } from '../../../packages/integrations/android-display/application/AndroidDisplayBridgePort';
import { AndroidDisplayServiceError } from '../../../packages/integrations/android-display/application/AndroidDisplayService';
import type { AndroidDisplayService } from '../../../packages/integrations/android-display/application/AndroidDisplayService';
import { ApiRoutes } from './ApiRoutes';

function objectWithKeys(value: unknown, required: string[], allowed: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.includes(key));
}

export class AndroidDisplayRoutes extends ApiRoutes {
  constructor(private readonly displays: AndroidDisplayService) { super(); }

  private async ownsHome(container: BootstrapContainer, userId: string, homeId: string): Promise<boolean> {
    const homes = await container.repositories.homeRepository.findHomesByUserId(userId);
    return homes.some((home) => home.id === homeId);
  }

  private sendDisplayError(res: http.ServerResponse, error: unknown): void {
    if (error instanceof AndroidDisplayServiceError || error instanceof AndroidDisplayBridgeError) {
      const code = error.code === 'UNAUTHORIZED' ? 'BRIDGE_UNAVAILABLE' : error.code;
      const status: Record<string, number> = {
        INVALID_ADB_ENDPOINT: 400, VALIDATION_ERROR: 400, HOME_NOT_FOUND: 404,
        DISPLAY_NOT_FOUND: 404, DISPLAY_ALREADY_EXISTS: 409, DISPLAY_DISABLED: 409,
        DISPLAY_NEEDS_AUTHORIZATION: 409, DISPLAY_OFFLINE: 503,
        ADB_ENDPOINT_NOT_ALLOWED: 403, ADB_OFFLINE: 503, ADB_TIMEOUT: 504,
        BRIDGE_TIMEOUT: 504, BRIDGE_BUSY: 503, DISPLAY_BUSY: 503,
        BRIDGE_NOT_CONFIGURED: 503, BRIDGE_UNAVAILABLE: 503, DISPLAY_NOT_CONNECTED: 503,
      };
      this.sendError(res, status[code] ?? 502, code);
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_JSON') {
      this.sendError(res, 400, 'VALIDATION_ERROR');
      return;
    }
    this.sendError(res, 500, 'INTERNAL_ERROR');
  }

  async handle(req: HomePilotRequest, res: http.ServerResponse, pathname: string, method: string,
    container: BootstrapContainer): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/android-displays')) return false;
    if (!await container.guards.authGuard.protect(req, res, true)) return true;
    if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

    if (method === 'POST' && pathname === '/api/v1/android-displays/test') {
      try {
        const body: unknown = await this.parseBody<unknown>(req);
        if (!objectWithKeys(body, ['homeId', 'host'], ['homeId', 'host', 'port'])
          || typeof body.homeId !== 'string' || typeof body.host !== 'string'
          || body.port !== undefined && body.port !== 5555) {
          this.sendError(res, 400, 'VALIDATION_ERROR'); return true;
        }
        if (!await this.ownsHome(container, req.user!.id, body.homeId)) {
          this.sendError(res, 403, 'FORBIDDEN'); return true;
        }
        this.sendJson(res, await this.displays.test({ host: body.host as string, port: body.port as number | undefined }));
      } catch (error: unknown) { this.sendDisplayError(res, error); }
      return true;
    }

    if (method === 'POST' && pathname === '/api/v1/android-displays') {
      try {
        const body: unknown = await this.parseBody<unknown>(req);
        if (!objectWithKeys(body, ['homeId', 'name', 'host'], ['homeId', 'name', 'host', 'port'])
          || typeof body.homeId !== 'string' || typeof body.name !== 'string'
          || typeof body.host !== 'string' || body.port !== undefined && body.port !== 5555) {
          this.sendError(res, 400, 'VALIDATION_ERROR'); return true;
        }
        if (!await this.ownsHome(container, req.user!.id, body.homeId)) {
          this.sendError(res, 403, 'FORBIDDEN'); return true;
        }
        const source = await this.displays.adopt({ homeId: body.homeId, name: body.name as string,
          host: body.host as string, port: body.port as number | undefined });
        this.sendJson(res, { display: source }, 201);
      } catch (error: unknown) { this.sendDisplayError(res, error); }
      return true;
    }

    if (method === 'GET' && pathname === '/api/v1/android-displays') {
      const url = new URL(req.url || pathname, 'http://localhost');
      const homeId = url.searchParams.get('homeId');
      if (!homeId) { this.sendError(res, 400, 'VALIDATION_ERROR'); return true; }
      if (!await this.ownsHome(container, req.user!.id, homeId)) {
        this.sendError(res, 403, 'FORBIDDEN'); return true;
      }
      this.sendJson(res, { displays: this.displays.list(homeId) });
      return true;
    }

    const match = pathname.match(/^\/api\/v1\/android-displays\/([0-9a-f-]{36})(?:\/(refresh))?$/);
    if (!match) return false;
    const source = this.displays.get(match[1]);
    if (!source) { this.sendError(res, 404, 'DISPLAY_NOT_FOUND'); return true; }
    if (!await this.ownsHome(container, req.user!.id, source.homeId)) {
      this.sendError(res, 403, 'FORBIDDEN'); return true;
    }
    if (method === 'GET' && !match[2]) {
      this.sendJson(res, { display: source }); return true;
    }
    if (method === 'POST' && match[2] === 'refresh') {
      try { this.sendJson(res, { display: await this.displays.refresh(source.deviceId) }); }
      catch (error: unknown) { this.sendDisplayError(res, error); }
      return true;
    }
    return false;
  }
}
