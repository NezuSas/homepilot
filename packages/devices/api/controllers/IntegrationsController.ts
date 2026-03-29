import { HttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { discoverDeviceUseCase } from '../../application/discoverDeviceUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository } from '../../domain/repositories';
import { DeviceEventPublisher } from '../../domain/events';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { IdGenerator, Clock } from '../../../shared/domain/types';

export class IntegrationsController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher: DeviceEventPublisher,
    private readonly topologyPort: TopologyReferencePort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  /**
   * Endpoint: POST /integrations/discovery
   * Operador Edge reservado para integraciones M2M de red.
   * No intercepta identificadores de usuario (Web/App Users).
   */
  async discoverDevice(req: HttpRequest): Promise<HttpResponse> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Invalid body.' }
        };
      }

      // Explicit type narrowing salvaguardando el unknown base
      const body = req.body as Record<string, unknown>;
      const { homeId, externalId, name, type, vendor } = body;

      // Validación estricta bloqueando vacíos e indeseables 
      if (
        typeof homeId !== 'string' || homeId.trim() === '' ||
        typeof externalId !== 'string' || externalId.trim() === '' ||
        typeof name !== 'string' || name.trim() === '' ||
        typeof type !== 'string' || type.trim() === '' ||
        typeof vendor !== 'string' || vendor.trim() === ''
      ) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid required discovery fields.' }
        };
      }

      const correlationId = (req.headers && typeof req.headers['x-correlation-id'] === 'string') 
        ? req.headers['x-correlation-id'] 
        : this.idGenerator.generate();

      const device = await discoverDeviceUseCase(
        homeId.trim(),
        externalId.trim(),
        name.trim(),
        type.trim(),
        vendor.trim(),
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
        statusCode: 201,
        body: device
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
