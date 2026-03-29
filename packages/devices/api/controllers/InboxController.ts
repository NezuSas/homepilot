import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { listPendingInboxUseCase } from '../../application/listPendingInboxUseCase';
import { handleError } from '../core/errorHandler';
import { DeviceRepository } from '../../domain/repositories';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';

export class InboxController {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly topologyPort: TopologyReferencePort
  ) {}

  /**
   * Endpoint: GET /homes/:homeId/inbox
   * Gateway interactivo: intercepta al User y delega estrictamente comprobaciones al proxy cruzado de Contexto.
   */
  async getInbox(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const homeId = req.params?.homeId;
      const userId = req.userId;

      if (typeof homeId !== 'string' || homeId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Valid homeId parameter is required.' }
        };
      }

      const inbox = await listPendingInboxUseCase(
        homeId.trim(),
        userId,
        {
          deviceRepository: this.deviceRepository,
          topologyPort: this.topologyPort
        }
      );

      return {
        statusCode: 200,
        body: inbox
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
