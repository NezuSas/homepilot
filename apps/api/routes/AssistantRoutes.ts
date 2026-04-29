import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AssistantConverseRequest } from '../../../packages/assistant/application/AssistantConversationService';

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

    // GET /api/v1/assistant/shadow/status
    if (method === 'GET' && pathname === '/api/v1/assistant/shadow/status') {
      try {
        const status = container.services.assistantPlannerV2ShadowService.getStatus();
        this.sendJson(res, status);
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // GET /api/v1/assistant/findings
    if (method === 'GET' && pathname === '/api/v1/assistant/findings') {
      try {
        const findings = await container.services.assistantService.listOpen();
        this.sendJson(res, findings);
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // GET /api/v1/assistant/summary
    if (method === 'GET' && pathname === '/api/v1/assistant/summary') {
      try {
        const summary = await container.services.assistantService.getSummary();
        this.sendJson(res, summary);
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e instanceof Error ? e.message : String(e));
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
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // POST /api/v1/assistant/findings/:id/resolve
    const resolveMatch = method === 'POST' && pathname.match(/^\/api\/v1\/assistant\/findings\/([^\/]+)\/resolve$/);
    if (resolveMatch) {
      try {
        await container.services.assistantService.resolve(resolveMatch[1]);
        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ERROR', e instanceof Error ? e.message : String(e));
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
          (body.payload as Record<string, unknown>) || {},
          req.user!.id,
          correlationId
        );

        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_ACTION_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // POST /api/v1/assistant/preview
    if (method === 'POST' && pathname === '/api/v1/assistant/preview') {
      try {
        const body = await this.parseBody<{ prompt: string }>(req);
        if (!body.prompt) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'prompt is required'), true;
        }

        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        const intentResult = await container.services.intentInterpreterService.interpret(body.prompt);
        
        let intent;
        if ('type' in intentResult && (intentResult.type === 'failure' || intentResult.type === 'clarificationRequired')) {
          return this.sendError(res, 400, 'UNRESOLVED_INTENT', 'El comando requiere aclaración o no pudo ser interpretado directamente en la API.'), true;
        } else if ('type' in intentResult && intentResult.type === 'success') {
          intent = intentResult.intent;
        } else {
          intent = intentResult as any;
        }

        const preview = await container.services.assistantConfirmationPolicy.evaluate(intent, language);

        return this.sendJson(res, preview), true;
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_EXECUTION_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // POST /api/v1/assistant/execute
    if (method === 'POST' && pathname === '/api/v1/assistant/execute') {
      try {
        const body = await this.parseBody<{ prompt: string; confirmed?: boolean }>(req);
        if (!body.prompt) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'prompt is required'), true;
        }

        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        const intentResult = await container.services.intentInterpreterService.interpret(body.prompt);
        
        let intent;
        if ('type' in intentResult && (intentResult.type === 'failure' || intentResult.type === 'clarificationRequired')) {
          return this.sendError(res, 400, 'UNRESOLVED_INTENT', 'El comando requiere aclaración o no pudo ser interpretado directamente en la API.'), true;
        } else if ('type' in intentResult && intentResult.type === 'success') {
          intent = intentResult.intent;
        } else {
          intent = intentResult as any;
        }

        const policyResult = await container.services.assistantConfirmationPolicy.evaluate(intent, language);

        if (policyResult.requiresConfirmation && body.confirmed !== true) {
          return this.sendJson(res, { error: 'CONFIRMATION_REQUIRED', preview: policyResult }, 409), true;
        }

        const correlationId = `assistant:${Date.now()}`;

        if (intent.type === 'scene') {
          const scene = await container.repositories.sceneRepository.findSceneById(intent.target);
          if (!scene) {
            return this.sendError(res, 404, 'SCENE_NOT_FOUND', `Scene ${intent.target} not found`), true;
          }

          const result = await container.services.sceneExecutionService.execute(scene, {
            sourceType: 'manual',
            sourceId: 'assistant',
            correlationId
          });
          return this.sendJson(res, result), true;
        }

        if (intent.type === 'command') {
          // Wrap single command in a transient scene to ensure it goes through the execution pipeline (observability)
          const transientScene = {
            id: `assistant-transient-${crypto.randomUUID()}`,
            homeId: 'system',
            roomId: null,
            name: `Assistant NL: ${body.prompt}`,
            actions: [{
              deviceId: intent.deviceId,
              command: { name: intent.command, params: intent.params || {} }
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const result = await container.services.sceneExecutionService.execute(transientScene as any, {
            sourceType: 'manual',
            sourceId: 'assistant',
            correlationId
          });
          return this.sendJson(res, result), true;
        }

        return this.sendError(res, 422, 'INTENT_NOT_UNDERSTOOD', 'Assistant could not interpret the command'), true;
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_EXECUTION_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    // POST /api/v1/assistant/converse
    if (method === 'POST' && pathname === '/api/v1/assistant/converse') {
      try {
        const body = await this.parseBody<AssistantConverseRequest>(req);

        // Backend user name resolution (preferred over frontend payload)
        const sessionUserName = req.user ? (req.user.displayName || req.user.username) : undefined;
        body.userName = sessionUserName || body.userName;
        
        if (!body.prompt && !body.selectedOptionId) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'prompt or selectedOptionId is required'), true;
        }

        const language = req.headers['accept-language']?.startsWith('en') ? 'en' : 'es';
        
        const response = await container.services.assistantConversationService.converse(body, language);
        return this.sendJson(res, response), true;
      } catch (e: unknown) {
        this.sendError(res, 500, 'ASSISTANT_CONVERSE_ERROR', e instanceof Error ? e.message : String(e));
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Assistant route not found');
    return true;
  }
}
