import type { ServerResponse } from 'node:http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { ModbusService } from '../../../packages/integrations/modbus/application/ModbusService';
import { ModbusError } from '../../../packages/integrations/modbus/domain/Modbus';
import { ApiRoutes } from './ApiRoutes';

export class ModbusRoutes extends ApiRoutes {
  constructor(private readonly service: ModbusService) { super(); }
  async handle(req: HomePilotRequest, res: ServerResponse, pathname: string, method: string, container: BootstrapContainer): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/modbus/')) return false;
    if (!(await container.guards.authGuard.protect(req, res, true))) return true;
    if (!req.user) { this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required'); return true; }
    if (req.user.role !== 'admin') { this.sendError(res, 403, 'FORBIDDEN', 'Admin required'); return true; }
    try {
      const root = pathname === '/api/v1/modbus/connections';
      const connection = pathname.match(/^\/api\/v1\/modbus\/connections\/([^/]+)$/);
      const variable = pathname.match(/^\/api\/v1\/modbus\/connections\/([^/]+)\/variables(?:\/([^/]+))?$/);
      if (pathname === '/api/v1/modbus/probe' && method === 'POST') {
        const body = await this.parseBody<Record<string, unknown>>(req);
        if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.homeId !== 'string') throw new ModbusError('INVALID_CONFIG', 'homeId required');
        const controller = new AbortController();
        const abort = () => controller.abort();
        const closed = () => { if (!res.writableEnded) abort(); };
        req.once('aborted', abort); res.once('close', closed);
        try { const result = await this.service.probe(req.user.id, body.homeId, body, controller.signal); if (!controller.signal.aborted) this.sendJson(res, result); }
        finally { req.removeListener('aborted', abort); res.removeListener('close', closed); }
      } else if (root && method === 'GET') {
        const homeId = new URL(req.url ?? '', 'http://localhost').searchParams.get('homeId') ?? '';
        this.sendJson(res, { connections: await this.service.list(req.user.id, homeId) });
      } else if ((root && method === 'POST') || (connection && method === 'PUT')) {
        const body = await this.parseBody<Record<string, unknown>>(req);
        if (!body || typeof body !== 'object' || typeof body.homeId !== 'string') throw new ModbusError('INVALID_CONFIG', 'homeId required');
        this.sendJson(res, { connection: await this.service.saveConnection(req.user.id, body.homeId, body, connection?.[1]) });
      } else if (variable && ((method === 'POST' && !variable[2]) || (method === 'PUT' && variable[2]))) {
        const body = await this.parseBody<Record<string, unknown>>(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ModbusError('INVALID_CONFIG', 'Configuration required');
        this.sendJson(res, { variable: await this.service.saveVariable(req.user.id, variable[1], body, variable[2]) });
      } else if (connection && method === 'DELETE') {
        await this.service.deleteConnection(req.user.id, connection[1]); this.sendJson(res, { deleted: true });
      } else if (variable?.[2] && method === 'DELETE') {
        await this.service.deleteVariable(req.user.id, variable[1], variable[2]); this.sendJson(res, { deleted: true });
      } else this.sendError(res, 404, 'NOT_FOUND', 'Modbus route not found');
    } catch (error: unknown) {
      if (res.destroyed) return true;
      const status = error instanceof ModbusError ? error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : ['LIMIT', 'IN_USE'].includes(error.code) ? 409 : 400 : 500;
      this.sendError(res, status, error instanceof ModbusError ? error.code : 'INTERNAL_ERROR', 'Modbus request could not be completed');
    }
    return true;
  }
}
