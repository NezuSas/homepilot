import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { assignDeviceUseCase } from '../../application/assignDeviceUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository } from '../../domain/repositories';
import { DeviceEventPublisher } from '../../domain/events';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { IdGenerator, Clock } from '../../../shared/domain/types';

export class DeviceController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher: DeviceEventPublisher,
    private readonly topologyPort: TopologyReferencePort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  /**
   * Endpoint: POST /devices/:deviceId/assign
   * Endpoint transaccional principal bloqueando asignaciones relacionales ajenas estructuralmente.
   */
  async assignDevice(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const deviceId = req.params?.deviceId;

      if (!req.body || typeof req.body !== 'object') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Invalid body.' }
        };
      }

      // Narrowing explicit del contrato
      const body = req.body as Record<string, unknown>;
      const roomId = body.roomId;
      const userId = req.userId;

      if (typeof deviceId !== 'string' || deviceId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Valid deviceId parameter is required.' }
        };
      }

      // roomId puede ser null (unassign) o string no vacío (assign/move)
      if (roomId !== null && (typeof roomId !== 'string' || roomId.trim() === '')) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Valid roomId (string or null) is required.' }
        };
      }

      const correlationId = (req.headers && typeof req.headers['x-correlation-id'] === 'string') 
        ? req.headers['x-correlation-id'] 
        : this.idGenerator.generate();

      const updatedDevice = await assignDeviceUseCase(
        deviceId.trim(),
        roomId === null ? null : (roomId as string).trim(),
        userId,
        correlationId,
        {
          deviceRepository: this.deviceRepository,
          eventPublisher: this.eventPublisher,
          topologyPort: this.topologyPort,
          idGenerator: this.idGenerator,
          clock: this.clock
        }
      );

      return {
        statusCode: 200,
        body: updatedDevice
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
