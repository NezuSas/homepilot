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
  trigger: AutomationTrigger;
  action: AutomationAction;
}

interface UpdateAutomationPayload {
  name?: string;
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
        if (home.ownerId !== userId) throw new ForbiddenOwnershipError(`Forbidden access to home ${homeId}`);
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
