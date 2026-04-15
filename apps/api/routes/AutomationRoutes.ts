import * as http from 'http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { BootstrapContainer } from '../../../bootstrap';
import { createAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/CreateAutomationRuleUseCase';
import { enableAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/EnableAutomationRuleUseCase';
import { disableAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/DisableAutomationRuleUseCase';
import { deleteAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/DeleteAutomationRuleUseCase';
import { updateAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/UpdateAutomationRuleUseCase';
import { ApiRoutes } from './ApiRoutes';

interface CreateAutomationPayload {
  name: string;
  trigger: any;
  action: any;
}

interface UpdateAutomationPayload {
  name?: string;
  trigger?: any;
  action?: any;
}

/**
 * Automation routes: /api/v1/automations/*
 */
export class AutomationRoutes extends ApiRoutes {
  constructor(private readonly dbPath: string) {
    super();
  }

  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/automations')) return false;

    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;
    const authReq = req as any;

    // GET /api/v1/automations
    if (method === 'GET' && pathname === '/api/v1/automations') {
      try {
        const rules = await container.repositories.automationRuleRepository.findAll();
        this.sendJson(res, rules);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return true;
    }

    // POST /api/v1/automations
    if (method === 'POST' && pathname === '/api/v1/automations') {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<CreateAutomationPayload>(req);
        const db = SqliteDatabaseManager.getInstance(this.dbPath);
        const home = db.prepare('SELECT id FROM homes LIMIT 1').get() as { id: string } | undefined;
        if (!home) return this.sendError(res, 500, 'HOME_NOT_FOUND', 'No local home found'), true;

        const result = await createAutomationRuleUseCase(
          {
            homeId: home.id,
            userId: authReq.user.id,
            name: payload.name,
            trigger: payload.trigger,
            action: payload.action,
          },
          {
            automationRuleRepository: container.repositories.automationRuleRepository,
            deviceRepository: container.repositories.deviceRepository,
            topologyReferencePort: {
              validateHomeExists: async () => {},
              validateHomeOwnership: async () => {},
              validateRoomBelongsToHome: async () => {},
            },
            idGenerator: { generate: () => crypto.randomUUID() },
          }
        );
        this.sendJson(res, result, 201);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, error.message);
      }
      return true;
    }

    // PATCH /api/v1/automations/:id
    const patchAutoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (patchAutoMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      const ruleId = patchAutoMatch[1];
      try {
        const payload = await this.parseBody<UpdateAutomationPayload>(req);
        const ports = {
          validateHomeOwnership: async () => {},
          validateHomeExists: async () => {},
          validateRoomBelongsToHome: async () => {},
        };
        const result = await updateAutomationRuleUseCase(ruleId, authReq.user.id, payload, {
          automationRuleRepository: container.repositories.automationRuleRepository,
          deviceRepository: container.repositories.deviceRepository,
          topologyReferencePort: ports,
        });
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'AutomationRuleNotFoundError') { status = 404; code = 'AUTOMATION_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, error.message);
      }
      return true;
    }

    // PATCH /api/v1/automations/:id/(enable|disable)
    const autoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)\/(enable|disable)$/);
    if (autoMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      const ruleId = autoMatch[1];
      const act = autoMatch[2];
      try {
        const ports = {
          validateHomeOwnership: async () => {},
          validateHomeExists: async () => {},
          validateRoomBelongsToHome: async () => {},
        };
        const result =
          act === 'enable'
            ? await enableAutomationRuleUseCase(ruleId, authReq.user.id, {
                automationRuleRepository: container.repositories.automationRuleRepository,
                topologyReferencePort: ports,
              })
            : await disableAutomationRuleUseCase(ruleId, authReq.user.id, {
                automationRuleRepository: container.repositories.automationRuleRepository,
                topologyReferencePort: ports,
              });
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_ERROR', error.message);
      }
      return true;
    }

    // DELETE /api/v1/automations/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (deleteMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      const ruleId = deleteMatch[1];
      try {
        const ports = {
          validateHomeOwnership: async () => {},
          validateHomeExists: async () => {},
          validateRoomBelongsToHome: async () => {},
        };
        await deleteAutomationRuleUseCase(ruleId, authReq.user.id, {
          automationRuleRepository: container.repositories.automationRuleRepository,
          topologyReferencePort: ports,
        });
        res.writeHead(204).end();
      } catch (error: any) {
        const name = error.constructor.name;
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_DELETE_ERROR', error.message);
      }
      return true;
    }

    return false;
  }
}
