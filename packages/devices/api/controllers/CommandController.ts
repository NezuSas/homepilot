import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { executeDeviceCommandUseCase } from '../../application/executeDeviceCommandUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository } from '../../domain/repositories';
import { DeviceEventPublisher } from '../../domain/events';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { DeviceCommandDispatcherPort } from '../../application/ports/DeviceCommandDispatcherPort';
import { ActivityLogRepository } from '../../domain/repositories/ActivityLogRepository';
import { IdGenerator, Clock } from '../../../shared/domain/types';

export class CommandController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher: DeviceEventPublisher,
    private readonly topologyPort: TopologyReferencePort,
    private readonly dispatcherPort: DeviceCommandDispatcherPort,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  /**
   * Endpoint: POST /devices/:deviceId/commands
   * Ejecuta una instrucción binaria V1 sobre un dispositivo validado topológicamente.
   * Requiere contexto de identidad autenticada.
   */
  async executeCommand(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const deviceId = req.params?.deviceId;
      
      if (typeof deviceId !== 'string' || deviceId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid deviceId parameter.' }
        };
      }

      if (!req.body || typeof req.body !== 'object') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Invalid body.' }
        };
      }

      const body = req.body as Record<string, unknown>;
      const { command } = body;

      if (typeof command !== 'string' || command.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid command field.' }
        };
      }

      const correlationId = (req.headers && typeof req.headers['x-correlation-id'] === 'string') 
        ? req.headers['x-correlation-id'] 
        : this.idGenerator.generate();

      await executeDeviceCommandUseCase(
        deviceId,
        command.trim(),
        req.userId,
        correlationId,
        {
          deviceRepository: this.deviceRepository,
          eventPublisher: this.eventPublisher,
          topologyPort: this.topologyPort,
          dispatcherPort: this.dispatcherPort,
          activityLogRepository: this.activityLogRepository,
          idGenerator: this.idGenerator,
          clock: this.clock
        }
      );

      // 202 Accepted: La solicitud ha sido aceptada para su procesamiento (despachada al Gateway físico).
      return {
        statusCode: 202,
        body: { message: 'Command accepted and dispatched to gateway.' }
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
