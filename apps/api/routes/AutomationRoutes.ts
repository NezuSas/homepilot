import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { createAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/CreateAutomationRuleUseCase';
import { enableAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/EnableAutomationRuleUseCase';
import { disableAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/DisableAutomationRuleUseCase';
import { deleteAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/DeleteAutomationRuleUseCase';
import { updateAutomationRuleUseCase } from '../../../packages/devices/application/usecases/automation/UpdateAutomationRuleUseCase';
import { listAutomationRulesUseCase } from '../../../packages/devices/application/usecases/automation/ListAutomationRulesUseCase';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { AutomationAction, AutomationTrigger } from '../../../packages/devices/domain/automation/types';
import { ForbiddenOwnershipError, TopologyResourceNotFoundError } from '../../../packages/devices/application/errors';
import type { TopologyReferencePort } from '../../../packages/devices/application/ports/TopologyReferencePort';

interface CreateAutomationPayload {
  name: string;
  icon?: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

interface UpdateAutomationPayload {
  name?: string;
  icon?: string;
  trigger?: AutomationTrigger;
  action?: AutomationAction;
}

/**
 * Automation routes: /api/v1/automations/*
 */
export class AutomationRoutes extends ApiRoutes {
  private createTopologyReferencePort(container: BootstrapContainer): TopologyReferencePort {
    return {
      validateHomeExists: async (homeId) => {
        const home = await container.repositories.homeRepository.findHomeById(homeId);
        if (!home) throw new TopologyResourceNotFoundError('Home', homeId);
      },
      validateHomeOwnership: async (homeId, userId) => {
        const home = await container.repositories.homeRepository.findHomeById(homeId);
        if (!home) throw new TopologyResourceNotFoundError('Home', homeId);
        const homes = await container.repositories.homeRepository.findHomesByUserId(userId);
        if (homes[0]?.id !== home.id) throw new ForbiddenOwnershipError(`Forbidden access to home ${homeId}`);
      },
      validateRoomBelongsToHome: async (roomId, homeId) => {
        const room = await container.repositories.roomRepository.findRoomById(roomId);
        if (!room) throw new TopologyResourceNotFoundError('Room', roomId);
        if (room.homeId !== homeId) throw new ForbiddenOwnershipError(`Room ${roomId} does not belong to home ${homeId}`);
      },
    };
  }
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/automations')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    if (pathname === '/api/v1/automations/favorites' && (method === 'GET' || method === 'PUT')) {
      try {
        const userId = req.user!.id;
        const key = 'pref:automation-favorites';
        const memory = container.repositories.assistantMemoryRepository;
        const homes = await container.repositories.homeRepository.findHomesByUserId(userId);
        const homeIds = new Set(homes.map((home) => home.id));
        const saved = await memory.findByKey(userId, key);
        const stored: unknown = saved ? JSON.parse(saved.value) : [];
        const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
        if (method === 'GET') {
          const accessible = await Promise.all(ids.map(async (id) => {
            const rule = await container.repositories.automationRuleRepository.findById(id);
            return rule && homeIds.has(rule.homeId) ? id : null;
          }));
          return this.sendJson(res, {
            automationIds: accessible.filter((id): id is string => id !== null),
            initialized: saved !== null,
          }), true;
        }
        const payload = await this.parseBody<{ automationIds?: unknown }>(req);
        if (!Array.isArray(payload?.automationIds) || payload.automationIds.length > 200
          || payload.automationIds.some((id) => typeof id !== 'string' || !id.trim())
          || new Set(payload.automationIds).size !== payload.automationIds.length) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'automationIds must be a unique array of automation IDs'), true;
        }
        const nextIds = payload.automationIds as string[];
        for (const id of nextIds) {
          const rule = await container.repositories.automationRuleRepository.findById(id);
          if (!rule || !homeIds.has(rule.homeId)) {
            return this.sendError(res, 403, 'FORBIDDEN', 'Automation is not accessible'), true;
          }
        }
        await memory.upsert({ userId, key, value: JSON.stringify(nextIds), valueType: 'json', expiresAt: null });
        return this.sendJson(res, nextIds), true;
      } catch (error: unknown) {
        return this.sendError(res, 500, 'AUTOMATION_FAVORITES_ERROR', error instanceof Error ? error.message : 'Unknown error'), true;
      }
    }

    // GET /api/v1/automations
    if (method === 'GET' && pathname === '/api/v1/automations') {
      try {
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        const home = homes[0];
        if (!home) return this.sendJson(res, []), true;

        const rules = await listAutomationRulesUseCase(home.id, req.user!.id, {
          automationRuleRepository: container.repositories.automationRuleRepository,
          topologyReferencePort: this.createTopologyReferencePort(container),
        });
        this.sendJson(res, rules);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', this.getErrorDetails(error).message);
      }
      return true;
    }

    // POST /api/v1/automations
    if (method === 'POST' && pathname === '/api/v1/automations') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<CreateAutomationPayload>(req);
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        const home = homes[0];
        if (!home) return this.sendError(res, 404, 'HOME_NOT_FOUND', 'No home belongs to the current user'), true;

        const result = await createAutomationRuleUseCase(
          {
            homeId: home.id,
            userId: req.user!.id,
            name: payload.name,
            icon: payload.icon,
            trigger: payload.trigger,
            action: payload.action,
          },
          {
            automationRuleRepository: container.repositories.automationRuleRepository,
            deviceRepository: container.repositories.deviceRepository,
            topologyReferencePort: this.createTopologyReferencePort(container),

            idGenerator: { generate: () => crypto.randomUUID() },
          }
        );
        this.sendJson(res, result, 201);
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, message);
      }
      return true;
    }

    // PATCH /api/v1/automations/:id
    const patchAutoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (patchAutoMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      const ruleId = patchAutoMatch[1];
      try {
        const payload = await this.parseBody<UpdateAutomationPayload>(req);
        const ports = this.createTopologyReferencePort(container);

        const result = await updateAutomationRuleUseCase(ruleId, req.user!.id, payload, {
          automationRuleRepository: container.repositories.automationRuleRepository,
          deviceRepository: container.repositories.deviceRepository,
          topologyReferencePort: ports,
        });
        this.sendJson(res, result);
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'AutomationRuleNotFoundError') { status = 404; code = 'AUTOMATION_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, message);
      }
      return true;
    }

    // PATCH /api/v1/automations/:id/(enable|disable)
    const autoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)\/(enable|disable)$/);
    if (autoMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      const ruleId = autoMatch[1];
      const act = autoMatch[2];
      try {
        const ports = this.createTopologyReferencePort(container);

        const result =
          act === 'enable'
            ? await enableAutomationRuleUseCase(ruleId, req.user!.id, {
                automationRuleRepository: container.repositories.automationRuleRepository,
                topologyReferencePort: ports,
              })
            : await disableAutomationRuleUseCase(ruleId, req.user!.id, {
                automationRuleRepository: container.repositories.automationRuleRepository,
                topologyReferencePort: ports,
              });
        this.sendJson(res, result);
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_ERROR', message);
      }
      return true;
    }

    // POST /api/v1/automations/:id/run — manual "run now", used by dashboard action cards.
    const runMatch = method === 'POST' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)\/run$/);
    if (runMatch) {
      const ruleId = runMatch[1];
      try {
        const rule = await container.repositories.automationRuleRepository.findById(ruleId);
        if (!rule) { this.sendError(res, 404, 'AUTOMATION_NOT_FOUND', `Automation ${ruleId} not found`); return true; }
        await this.createTopologyReferencePort(container).validateHomeOwnership(rule.homeId, req.user!.id);

        if (!container.engine) {
          this.sendError(res, 503, 'AUTOMATION_ENGINE_UNAVAILABLE', 'Automation engine is not running');
          return true;
        }

        const correlationId = crypto.randomUUID();
        const result = await container.engine.runRuleNow(ruleId, correlationId);
        if (!result.success) {
          this.sendError(res, 502, 'AUTOMATION_RUN_FAILED', result.error || `Automation ${ruleId} failed to run`);
          return true;
        }
        this.sendJson(res, { success: true, correlationId });
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        this.sendError(res, name === 'ForbiddenOwnershipError' ? 403 : 500, 'AUTOMATION_RUN_ERROR', message);
      }
      return true;
    }

    // DELETE /api/v1/automations/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (deleteMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      const ruleId = deleteMatch[1];
      try {
        const ports = this.createTopologyReferencePort(container);

        await deleteAutomationRuleUseCase(ruleId, req.user!.id, {
          automationRuleRepository: container.repositories.automationRuleRepository,
          topologyReferencePort: ports,
        });
        res.writeHead(204).end();
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_DELETE_ERROR', message);
      }
      return true;
    }

    return false;
  }
}
