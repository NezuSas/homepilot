import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { getDeviceStateUseCase } from '../../application/getDeviceStateUseCase';
import { getDeviceActivityHistoryUseCase } from '../../application/getDeviceActivityHistoryUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository, ActivityLogRepository } from '../../domain/repositories';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';

/**
 * Controlador de Observabilidad para usuarios finales (Web/App).
 * Expone el estado actual y el historial de actividad bajo reglas Zero-Trust.
 */
export class ObservabilityController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly topologyPort: TopologyReferencePort
  ) {}

  /**
   * Endpoint: GET /devices/:deviceId/state
   * Recupera el snapshot más reciente del estado del dispositivo.
   */
  async getState(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const { deviceId } = req.params || {};
      
      if (typeof deviceId !== 'string' || deviceId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'A valid deviceId parameter is required.' }
        };
      }

      const state = await getDeviceStateUseCase(deviceId.trim(), req.userId, {
        deviceRepository: this.deviceRepository,
        topologyPort: this.topologyPort
      });

      return {
        statusCode: 200,
        body: state
      };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Endpoint: GET /devices/:deviceId/history
   * Recupera la traza de actividad (estados y comandos) del dispositivo.
   */
  async getHistory(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const { deviceId } = req.params || {};
      
      if (typeof deviceId !== 'string' || deviceId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'A valid deviceId parameter is required.' }
        };
      }

      // Política de Límite V1: Normalización a default seguro si es inválido, NaN o <= 0.
      let limit = 50; 
      const limitParam = req.query?.limit;

      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 100); // Tope de seguridad en 100 para V1
        }
      }

      const history = await getDeviceActivityHistoryUseCase(deviceId.trim(), req.userId, limit, {
        deviceRepository: this.deviceRepository,
        topologyPort: this.topologyPort,
        activityLogRepository: this.activityLogRepository
      });

      return {
        statusCode: 200,
        body: history
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
