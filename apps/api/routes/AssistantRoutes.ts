import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

/**
 * Assistant routes: /api/v1/assistant/*
 */
export class AssistantRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/assistant/')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/assistant/findings
    if (method === 'GET' && pathname === '/api/v1/assistant/findings') {
      try {
        const findings = await container.services.assistantService.listOpen();
        this.sendJson(res, findings);
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e.message);
      }
      return true;
    }

    // GET /api/v1/assistant/summary
    if (method === 'GET' && pathname === '/api/v1/assistant/summary') {
      try {
        const summary = await container.services.assistantService.getSummary();
        this.sendJson(res, summary);
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/assistant/scan
    if (method === 'POST' && pathname === '/api/v1/assistant/scan') {
      try {
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes.length > 0) {
          await container.services.assistantService.scan(homes[0].id, 'manual_trigger');
        }
        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_SCAN_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/assistant/findings/:id/dismiss
    const dismissMatch = method === 'POST' && pathname.match(/^\/api\/v1\/assistant\/findings\/([^\/]+)\/dismiss$/);
    if (dismissMatch) {
      try {
        await container.services.assistantService.dismiss(dismissMatch[1]);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/assistant/findings/:id/resolve
    const resolveMatch = method === 'POST' && pathname.match(/^\/api\/v1\/assistant\/findings\/([^\/]+)\/resolve$/);
    if (resolveMatch) {
      try {
        await container.services.assistantService.resolve(resolveMatch[1]);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/assistant/actions
    if (method === 'POST' && pathname === '/api/v1/assistant/actions') {
      try {
        const body = await this.parseBody<{ findingId: string; actionType: string; payload?: unknown }>(req);
        if (!body.findingId || !body.actionType) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'findingId and actionType are required'), true;
        }

        const correlationId =
          req.headers && typeof req.headers['x-correlation-id'] === 'string'
            ? req.headers['x-correlation-id']
            : crypto.randomUUID();

        await container.services.assistantActionService.handleAction(
          body.findingId,
          body.actionType,
          body.payload || {},
          req.user!.id,
          correlationId
        );

        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 500, 'ASSISTANT_ACTION_ERROR', e.message);
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Assistant route not found');
    return true;
  }
}
