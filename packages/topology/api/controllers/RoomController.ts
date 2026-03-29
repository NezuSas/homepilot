import { AuthenticatedHttpRequest, HttpResponse } from '../core/http';
import { handleError } from '../core/errorHandler';
import { 
  createRoomUseCase, 
  listRoomsUseCase, 
  CreateRoomUseCaseDependencies,
  ListRoomsUseCaseDependencies
} from '../../application';

/**
 * Controlador API conectando las transferencias HTTP con lógica de Salas/Rooms protegida.
 */
export class RoomController {
  constructor(
    private readonly createDeps: CreateRoomUseCaseDependencies,
    private readonly listDeps: ListRoomsUseCaseDependencies
  ) {}

  /**
   * Endpoint POST /rooms
   */
  async createRoom(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      // Narrowing explícito
      const isObjectBody = typeof req.body === 'object' && req.body !== null;
      const bodyParams = isObjectBody ? (req.body as Record<string, unknown>) : {};
      
      const name = bodyParams.name;
      const homeId = bodyParams.homeId;

      // Detección sintáctica de payloads malformados HTTP sin usar validaciones cruzadas.
      if (typeof name !== 'string' || name.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request: name is required' } };
      }

      if (typeof homeId !== 'string' || homeId.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request: homeId is required' } };
      }

      const correlationId = req.headers?.['x-correlation-id'] || '';

      const room = await createRoomUseCase(
        name.trim(),
        homeId.trim(),
        req.userId, // Inyección segura proveniente del Request Handler Interceptor
        correlationId,
        this.createDeps
      );

      return { statusCode: 201, body: room };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Endpoint GET /rooms
   */
  async listRooms(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      // Capturamos el id desde Query Parameter como acercamiento RESTful primario
      const homeId = req.query?.homeId;

      if (typeof homeId !== 'string' || homeId.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request: homeId query parameter is required' } };
      }

      const rooms = await listRoomsUseCase(
        homeId.trim(),
        req.userId,
        this.listDeps
      );

      return { statusCode: 200, body: rooms };
    } catch (error) {
      return handleError(error);
    }
  }
}
