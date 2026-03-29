import { AuthenticatedHttpRequest, HttpResponse } from '../core/http';
import { handleError } from '../core/errorHandler';
import { 
  createHomeUseCase, 
  listHomesUseCase, 
  CreateHomeUseCaseDependencies,
  ListHomesUseCaseDependencies
} from '../../application';

/**
 * Controlador perimetral que acopla el Dominio Topológico sobre orquestadores HTTP.
 */
export class HomeController {
  constructor(
    private readonly createDeps: CreateHomeUseCaseDependencies,
    private readonly listDeps: ListHomesUseCaseDependencies
  ) {}

  /**
   * Endpoint POST /homes
   */
  async createHome(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      // Narrowing explícito y type-safety sin usar "any"
      const isObjectBody = typeof req.body === 'object' && req.body !== null;
      const bodyParams = isObjectBody ? (req.body as Record<string, unknown>) : {};
      
      const name = bodyParams.name;

      if (typeof name !== 'string' || name.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request: name is required' } };
      }

      // Estrategia explícita y limpia sin mocks absurdos
      const correlationId = req.headers?.['x-correlation-id'] || '';

      const home = await createHomeUseCase(
        name.trim(),
        req.userId, // Validado estructuralmente por AuthenticatedHttpRequest
        correlationId,
        this.createDeps
      );

      return { statusCode: 201, body: home };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Endpoint GET /homes
   */
  async listHomes(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const homes = await listHomesUseCase(req.userId, this.listDeps);
      
      // Retornará un array vacío natural [] con un status 200 en vez de arrojar exception si count == 0.
      return { statusCode: 200, body: homes };
    } catch (error) {
      return handleError(error);
    }
  }
}
