import { HttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { syncDeviceStateUseCase } from '../../application/syncDeviceStateUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository } from '../../domain/repositories';
import { DeviceEventPublisher } from '../../domain/events';
import { ActivityLogRepository } from '../../domain/repositories';
import { IdGenerator, Clock } from '../../../shared/domain/types';

/**
 * Controlador especializado en la ingesta masiva o puntual de estados desde el Edge.
 * Orientado a comunicación M2M (Machine-to-Machine) sin contexto de sesión de usuario.
 */
export class StateIngestionController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher: DeviceEventPublisher,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  /**
   * Endpoint: POST /integrations/state-sync
   * Sincroniza el estado reportado por un gateway externo.
   */
  async syncState(req: HttpRequest): Promise<HttpResponse> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Invalid body.' }
        };
      }

      const { deviceId, state } = req.body as Record<string, unknown>;

      if (typeof deviceId !== 'string' || deviceId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid deviceId.' }
        };
      }

      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid state object. Arrays are not permitted in V1.' }
        };
      }

      const correlationId = (req.headers && typeof req.headers['x-correlation-id'] === 'string') 
        ? req.headers['x-correlation-id'] 
        : this.idGenerator.generate();

      // Orquestación delegada al caso de uso (Idempotencia incluida)
      await syncDeviceStateUseCase(
        deviceId.trim(),
        state as Record<string, unknown>,
        correlationId,
        {
          deviceRepository: this.deviceRepository,
          eventPublisher: this.eventPublisher,
          activityLogRepository: this.activityLogRepository,
          idGenerator: this.idGenerator,
          clock: this.clock
        }
      );

      return {
        statusCode: 200,
        body: { status: 'success' }
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
