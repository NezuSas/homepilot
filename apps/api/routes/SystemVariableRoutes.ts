import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import type { SystemVariable } from '../../../packages/system-vars/domain/SystemVariable';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

/**
 * System Variable routes: /api/v1/system-variables/*
 *
 * All endpoints require authentication. Write operations (POST, DELETE) are
 * restricted to the 'admin' role.
 */
export class SystemVariableRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/system-variables')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/system-variables
    if (method === 'GET' && pathname === '/api/v1/system-variables') {
      try {
        const urlParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        const scope = urlParams.get('scope') as 'global' | 'home' | null;
        const homeId = urlParams.get('homeId') ?? undefined;

        const filter: { scope?: 'global' | 'home'; homeId?: string } = {};
        if (scope === 'global' || scope === 'home') filter.scope = scope;
        if (homeId) filter.homeId = homeId;

        const variables = await container.services.systemVariableService.list(filter);
        this.sendJson(res, variables);
      } catch (e: any) {
        this.sendError(res, 500, 'INTERNAL_ERROR', e.message);
      }
      return true;
    }

    // GET /api/v1/system-variables/:id
    const getMatch = method === 'GET' && pathname.match(/^\/api\/v1\/system-variables\/([^/]+)$/);
    if (getMatch) {
      try {
        const variable = await container.services.systemVariableService.getById(getMatch[1]);
        if (!variable) return this.sendError(res, 404, 'NOT_FOUND', 'Variable not found'), true;
        this.sendJson(res, variable);
      } catch (e: any) {
        this.sendError(res, 500, 'INTERNAL_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/system-variables (create or update)
    if (method === 'POST' && pathname === '/api/v1/system-variables') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const body = await this.parseBody<{
          scope?: string;
          homeId?: string | null;
          name?: string;
          value?: string;
          valueType?: string;
          description?: string | null;
          ttlSeconds?: number | null;
        }>(req);

        if (!body.name || !body.value || !body.scope || !body.valueType) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'scope, name, value, valueType are required'), true;
        }
        if (body.scope !== 'global' && body.scope !== 'home') {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'scope must be global or home'), true;
        }
        if (!['string', 'number', 'boolean', 'json'].includes(body.valueType)) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'valueType must be string, number, boolean or json'), true;
        }

        const variable = await container.services.systemVariableService.set({
          scope: body.scope,
          homeId: body.homeId ?? null,
          name: body.name,
          value: body.value,
          valueType: body.valueType as SystemVariable['valueType'],
          description: body.description ?? null,
          ttlSeconds: body.ttlSeconds ?? null,
        });

        this.sendJson(res, variable, 200);
      } catch (e: any) {
        const knownCodes: Record<string, number> = {
          INVALID_VARIABLE_NAME: 400,
          VARIABLE_NAME_TOO_LONG: 400,
          INVALID_VARIABLE_VALUE: 400,
          HOME_SCOPED_VARIABLE_REQUIRES_HOME_ID: 400,
          INVALID_JSON_VALUE: 400,
          TTL_MUST_BE_POSITIVE: 400,
        };
        const status = knownCodes[e.message] ?? 500;
        this.sendError(res, status, e.message ?? 'INTERNAL_ERROR', e.message);
      }
      return true;
    }

    // DELETE /api/v1/system-variables/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/system-variables\/([^/]+)$/);
    if (deleteMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const deleted = await container.services.systemVariableService.delete(deleteMatch[1]);
        if (!deleted) return this.sendError(res, 404, 'NOT_FOUND', 'Variable not found'), true;
        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 500, 'INTERNAL_ERROR', e.message);
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'System variable route not found');
    return true;
  }
}


