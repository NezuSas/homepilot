import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ApiRoutes } from './ApiRoutes';
import { DeviceIntegrationRoutes } from './device/DeviceIntegrationRoutes';
import { DeviceReadRoutes } from './device/DeviceReadRoutes';
import { DeviceHomeAssistantRoutes } from './device/DeviceHomeAssistantRoutes';
import { DeviceMutationRoutes } from './device/DeviceMutationRoutes';
import { DeviceCommandRoutes } from './device/DeviceCommandRoutes';

/**
 * Device routes: /api/v1/devices/*, /api/v1/activity-logs, /api/v1/ha/*
 *
 * Punto de entrada: compone los grupos de rutas de `./device/`. Las rutas M2M
 * (clave de integración) se resuelven antes del guard de sesión; el resto exige
 * autenticación antes de despachar a cada grupo.
 */
export class DeviceRoutes extends ApiRoutes {
  private readonly integrationRoutes = new DeviceIntegrationRoutes();
  private readonly authenticatedGroups: ReadonlyArray<ApiRoutes> = [
    new DeviceReadRoutes(),
    new DeviceHomeAssistantRoutes(),
    new DeviceMutationRoutes(),
    new DeviceCommandRoutes(),
  ];

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (await this.integrationRoutes.handle(req, res, pathname, method, container)) return true;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    for (const group of this.authenticatedGroups) {
      if (await group.handle(req, res, pathname, method, container)) return true;
    }

    return false;
  }
}
