import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AssistantConverseRequest } from '../../../packages/assistant/application/AssistantConversationService';
import {
  AssistantTextToSpeechUnavailableError,
  AssistantTextToSpeechValidationError
} from '../../../packages/assistant/application/AssistantTextToSpeechService';
import {
  AssistantSpeechToTextUnavailableError,
  AssistantSpeechToTextValidationError
} from '../../../packages/assistant/application/AssistantSpeechToTextService';
import { sanitizeAssistantResponse } from '../../../packages/assistant/application/AssistantResponseSanitizer';

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

    const authorizedHomeIds = (await container.repositories.homeRepository.findHomesByUserId(req.user!.id)).map((home) => home.id);

    // GET /api/v1/assistant/shadow/status
    if (method === 'GET' && pathname === '/api/v1/assistant/shadow/status') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const status = container.services.assistantPlannerV2ShadowService.getStatus();
        this.sendJson(res, status);
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // GET /api/v1/assistant/shadow/metrics
    if (method === 'GET' && pathname === '/api/v1/assistant/shadow/metrics') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const metrics = container.services.assistantPlannerV2ShadowService.getMetrics();
        this.sendJson(res, metrics);
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // GET /api/v1/assistant/findings
    if (method === 'GET' && pathname === '/api/v1/assistant/findings') {
      try {
        const findings = await container.services.assistantService.listOpen(authorizedHomeIds);
        this.sendJson(res, findings);
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // GET /api/v1/assistant/summary
    if (method === 'GET' && pathname === '/api/v1/assistant/summary') {
      try {
        const summary = await container.services.assistantService.getSummary(authorizedHomeIds);
        this.sendJson(res, summary);
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // POST /api/v1/assistant/scan
    if (method === 'POST' && pathname === '/api/v1/assistant/scan') {
      try {
        await Promise.all(authorizedHomeIds.map((homeId) => (
          container.services.assistantService.scan(homeId, 'manual_trigger')
        )));
        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_SCAN_ERROR', (e instanceof Error ? e.message : String(e)));
      }
      return true;
    }

    // POST /api/v1/assistant/findings/:id/dismiss
    const dismissMatch = method === 'POST' && pathname.match(/^\/api\/v1\/assistant\/findings\/([^\/]+)\/dismiss$/);
    if (dismissMatch) {
      try {
        await container.services.assistantService.dismiss(dismissMatch[1], authorizedHomeIds);
        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // POST /api/v1/assistant/findings/:id/resolve
    const resolveMatch = method === 'POST' && pathname.match(/^\/api\/v1\/assistant\/findings\/([^\/]+)\/resolve$/);
    if (resolveMatch) {
      try {
        await container.services.assistantService.resolve(resolveMatch[1], authorizedHomeIds);
        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendAssistantError(res, e);
      }
      return true;
    }

    // POST /api/v1/assistant/actions
    if (method === 'POST' && pathname === '/api/v1/assistant/actions') {
      if (!container.guards.authGuard.requireRole(req, res, 'parent')) return true;
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
          (body.payload as Record<string, unknown>) || {},
          req.user!.id,
          correlationId,
          authorizedHomeIds
        );

        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendAssistantError(res, e, 'ASSISTANT_ACTION_ERROR');
      }
      return true;
    }

    // POST /api/v1/assistant/converse
    if (method === 'POST' && pathname === '/api/v1/assistant/converse') {
      try {
        const body = await this.parseBody<AssistantConverseRequest>(req);
        body.userId = req.user!.id;
        body.confirmed = false;
        
        if (body.sourceRoomId) {
          console.info(`[ASSISTANT_CONTEXT_SOURCE] {"sourceRoomId":"${body.sourceRoomId}","source":"operator_console"}`);
        }

        // Backend user name resolution (preferred over frontend payload)
        const sessionUserName = req.user ? (req.user.displayName || req.user.username) : undefined;
        body.userName = sessionUserName || body.userName;
        
        if (!body.prompt && !body.selectedOptionId) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'prompt or selectedOptionId is required'), true;
        }

        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        
        const response = await container.services.assistantConversationService.converse(body, language);
        response.message = sanitizeAssistantResponse(response.message);
        return this.sendJson(res, response), true;
      } catch (e: unknown) {
        this.sendAssistantError(res, e, 'ASSISTANT_CONVERSE_ERROR');
      }
      return true;
    }

    // POST /api/v1/assistant/tts
    if (method === 'POST' && pathname === '/api/v1/assistant/tts') {
      try {
        const body = await this.parseBody<{ text?: string }>(req);
        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        const response = await container.services.assistantTextToSpeechService.synthesize({
          text: body.text || '',
          language
        });

        return this.sendJson(res, response), true;
      } catch (e: unknown) {
        if (e instanceof AssistantTextToSpeechValidationError) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', (e instanceof Error ? e.message : String(e))), true;
        }
        if (e instanceof AssistantTextToSpeechUnavailableError) {
          return this.sendError(res, 409, 'TTS_UNAVAILABLE', (e instanceof Error ? e.message : String(e))), true;
        }
        this.sendError(res, 500, 'ASSISTANT_TTS_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // POST /api/v1/assistant/stt
    if (method === 'POST' && pathname === '/api/v1/assistant/stt') {
      try {
        const body = await this.parseBody<{ audioBase64?: string; audioContentType?: string }>(req);
        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        const response = await container.services.assistantSpeechToTextService.transcribe({
          audioBase64: body.audioBase64 || '',
          audioContentType: body.audioContentType || '',
          language
        });

        return this.sendJson(res, response), true;
      } catch (e: unknown) {
        if (e instanceof AssistantSpeechToTextValidationError) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', (e instanceof Error ? e.message : String(e))), true;
        }
        if (e instanceof AssistantSpeechToTextUnavailableError) {
          return this.sendError(res, 409, 'STT_UNAVAILABLE', (e instanceof Error ? e.message : String(e))), true;
        }
        this.sendError(res, 500, 'ASSISTANT_STT_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Assistant route not found');
    return true;
  }

  private sendAssistantError(res: http.ServerResponse, error: unknown, fallbackCode: string = 'ASSISTANT_ERROR'): void {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'ASSISTANT_FINDING_FORBIDDEN' || message === 'ASSISTANT_HOME_FORBIDDEN' || message === 'ASSISTANT_AUTHORIZATION_UNAVAILABLE') {
      this.sendError(res, 403, 'FORBIDDEN', 'No tienes acceso a este hallazgo del asistente.');
      return;
    }
    this.sendError(res, 500, fallbackCode, message);
  }
}
