import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { getDeviceStateUseCase } from '../../../../packages/devices/application/getDeviceStateUseCase';
import { getDeviceActivityHistoryUseCase } from '../../../../packages/devices/application/getDeviceActivityHistoryUseCase';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { enrichDevice, toControlCatalogView, toEffectiveActionsView } from './deviceSerialization';
import { mapDeviceReadError } from './deviceErrorMapping';

/**
 * Authenticated read-only device routes (the caller has already passed the auth guard):
 * effective-actions, control-catalog, dashboard-action-targets, state, history,
 * activity-logs, device detail and listing.
 */
export class DeviceReadRoutes extends ApiRoutes {
  private sendDeviceReadError(res: http.ServerResponse, error: unknown): void {
    const { name, message } = this.getErrorDetails(error);
    const { status, code } = mapDeviceReadError(name);
    this.sendError(res, status, code, message);
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    const effectiveActionsMatch = method === 'GET'
      && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/effective-actions$/);
    if (effectiveActionsMatch) {
      res.setHeader('Cache-Control', 'no-store');
      try {
        const deviceId = effectiveActionsMatch[1];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND'), true;
        await container.adapters.topologyReferencePort.validateHomeOwnership(device.homeId, req.user!.id);
        const actions = await container.services.effectiveActionsProvider.getForDeviceId(deviceId);
        this.sendJson(res, toEffectiveActionsView(deviceId, actions));
      } catch (error: unknown) {
        this.sendDeviceReadError(res, error);
      }
      return true;
    }

    const controlCatalogMatch = method === 'GET'
      && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/control-catalog$/);
    if (controlCatalogMatch) {
      res.setHeader('Cache-Control', 'no-store');
      try {
        const device = await container.repositories.deviceRepository.findDeviceById(controlCatalogMatch[1]);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND'), true;
        await container.adapters.topologyReferencePort.validateHomeOwnership(device.homeId, req.user!.id);
        const catalog = container.services.deviceControlCatalogProvider.getForDevice(device);
        if (!catalog) return this.sendError(res, 404, 'DEVICE_NOT_FOUND'), true;
        this.sendJson(res, toControlCatalogView(catalog));
      } catch (error: unknown) {
        this.sendDeviceReadError(res, error);
      }
      return true;
    }

    if (method === 'GET' && pathname === '/api/v1/dashboard-action-targets') {
      res.setHeader('Cache-Control', 'no-store');
      try {
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        const devices = (await Promise.all(homes.map((home) =>
          container.repositories.deviceRepository.findAllByHomeId(home.id)))).flat();
        this.sendJson(res, container.services.deviceControlCatalogProvider.listDashboardActionsForDevices(devices));
      } catch (error: unknown) {
        this.sendDeviceReadError(res, error);
      }
      return true;
    }

    const stateMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/state$/);
    if (stateMatch) {
      try {
        const state = await getDeviceStateUseCase(stateMatch[1], req.user!.id, {
          deviceRepository: container.repositories.deviceRepository,
          topologyPort: container.adapters.topologyReferencePort,
        });
        this.sendJson(res, state);
      } catch (error: unknown) {
        this.sendDeviceReadError(res, error);
      }
      return true;
    }

    const historyMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/history$/);
    if (historyMatch) {
      try {
        const history = await getDeviceActivityHistoryUseCase(historyMatch[1], req.user!.id, 50, {
          deviceRepository: container.repositories.deviceRepository,
          activityLogRepository: container.repositories.activityLogRepository,
          topologyPort: container.adapters.topologyReferencePort,
        });
        this.sendJson(res, history);
      } catch (error: unknown) {
        this.sendDeviceReadError(res, error);
      }
      return true;
    }
    // GET /api/v1/devices/:id/activity-logs
    const deviceLogsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/activity-logs$/);
    if (deviceLogsMatch) {
      try {
        const deviceId = deviceLogsMatch[1];
        const logs = await container.repositories.activityLogRepository.findRecentByDeviceId(deviceId, 20);
        this.sendJson(res, logs);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/devices/:id
    const deviceDetailMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (deviceDetailMatch) {
      try {
        const deviceId = deviceDetailMatch[1];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        this.sendJson(res, enrichDevice(device));
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/devices
    if (method === 'GET' && pathname === '/api/v1/devices') {
      try {
        const devices = await container.repositories.deviceRepository.findAllOrderedByStatus();
        this.sendJson(res, devices.map(d => enrichDevice(d)));
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/activity-logs
    if (method === 'GET' && pathname === '/api/v1/activity-logs') {
      try {
        const logs = await container.repositories.activityLogRepository.findAllRecent(50);
        this.sendJson(res, logs);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    return false;
  }
}
