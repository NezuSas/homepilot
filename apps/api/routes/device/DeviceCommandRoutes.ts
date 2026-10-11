import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { executeDeviceCommandUseCase } from '../../../../packages/devices/application/executeDeviceCommandUseCase';
import { DeviceCommandV1, isValidCommand } from '../../../../packages/devices/domain/commands';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { enrichDevice } from './deviceSerialization';
import { mapActionExecuteError, mapCommandError } from './deviceErrorMapping';

/**
 * Device command execution routes:
 * POST /api/v1/devices/:id/actions/:key/execute, POST /api/v1/devices/:id/command
 */
export class DeviceCommandRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    const actionKeyMatch = method === 'POST'
      && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/actions\/([^\/]+)\/execute$/);
    if (actionKeyMatch) {
      try {
        const [deviceId, actionKey] = [actionKeyMatch[1], actionKeyMatch[2]];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND'), true;
        await container.adapters.topologyReferencePort.validateHomeOwnership(device.homeId, req.user!.id);
        if (device.integrationSource !== 'android-display') return this.sendError(res, 403, 'FORBIDDEN'), true;
        const payload = await this.parseBody<unknown>(req);
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
          || Object.keys(payload).length !== 0) {
          return this.sendError(res, 400, 'INVALID_COMMAND'), true;
        }
        const resolved = container.services.deviceControlCatalogProvider.resolveActionForDevice(device, actionKey);
        const command = resolved?.command;
        if (!resolved || !command?.dashboardEligible) return this.sendError(res, 403, 'FORBIDDEN'), true;

        if (command.executionRoute === 'homepilot' && command.semanticAction) {
          await executeDeviceCommandUseCase(deviceId, command.semanticAction, req.user!.id, crypto.randomUUID(), {
            deviceRepository: container.repositories.deviceRepository,
            eventPublisher: container.adapters.deviceEventPublisher,
            topologyPort: container.adapters.topologyReferencePort,
            dispatcherPort: container.adapters.commandDispatcher,
            activityLogRepository: container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() },
          }, { allowPendingManualExecution: true });
        } else if (command.executionRoute === 'intentflow') {
          await container.services.intentFlowCommandExecutionService.execute(resolved.boardId, actionKey);
        } else return this.sendError(res, 403, 'FORBIDDEN'), true;
        const updated = await container.repositories.deviceRepository.findDeviceById(deviceId);
        this.sendJson(res, updated ? enrichDevice(updated) : null);
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        const { status, code } = mapActionExecuteError(name, message);
        this.sendError(res, status, code, message);
      }
      return true;
    }

    // POST /api/v1/devices/:id/command
    const commandMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/command$/);
    if (commandMatch) {
      try {
        const payload = await this.parseBody<{ command?: string | { name: string; params?: Record<string, unknown> } }>(req);
        if (!payload.command) return this.sendError(res, 400, 'INVALID_COMMAND', 'Missing command'), true;

        const commandName = typeof payload.command === 'string' ? payload.command : payload.command.name;
        if (!isValidCommand(commandName))
          return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid command'), true;

        const commandDevice = await container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
        if (commandDevice?.integrationSource === 'android-display') {
          await container.adapters.topologyReferencePort.validateHomeOwnership(commandDevice.homeId, req.user!.id);
          const actions = await container.services.effectiveActionsProvider.getForDeviceId(commandDevice.id);
          if (!actions.some((action) => action.semanticAction === commandName && !action.requiresConfirmation)) {
            return this.sendError(res, 403, 'FORBIDDEN'), true;
          }
        }

        const compositeDispatcher = container.adapters.commandDispatcher;
        const correlationId = crypto.randomUUID();
        await executeDeviceCommandUseCase(
          commandMatch[1],
          typeof payload.command === 'string'
            ? (payload.command as DeviceCommandV1)
            : { name: payload.command.name as DeviceCommandV1, params: payload.command.params },
          req.user!.id,
          correlationId,
          {
            deviceRepository: container.repositories.deviceRepository,
            eventPublisher: container.adapters.deviceEventPublisher,
            topologyPort: container.adapters.topologyReferencePort,

            dispatcherPort: compositeDispatcher,
            activityLogRepository: container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() },
          },
          {
            allowPendingManualExecution: true,
          }
        );

        const upd = await container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
        if (upd?.integrationSource === 'ha' || upd?.integrationSource === 'home-assistant' || upd?.externalId.startsWith('ha:')) {
          container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
        }
        this.sendJson(res, upd ? enrichDevice(upd) : null);
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : 'Error';
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const { status, code } = mapCommandError(name);

        if (msg.includes('Home Assistant') || msg.includes('fetch')) {
          container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        }

        this.sendError(res, status, code, msg);
      }
      return true;
    }

    return false;
  }
}
