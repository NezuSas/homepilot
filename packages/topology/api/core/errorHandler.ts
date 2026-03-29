import { HttpResponse } from './http';
import { 
  NotFoundError, 
  ForbiddenError, 
  InvalidContextError 
} from '../../application';
import { TopologyDomainError } from '../../domain';

/**
 * Mapeador global de excepciones hacia semántica HTTP estricta dictada por el Spec.
 * Protege a los controladores de conocer las jerarquías de error internas.
 */
export function handleError(error: unknown): HttpResponse {
  // Errores de la capa de aplicación
  if (error instanceof InvalidContextError) {
    return { statusCode: 401, body: { error: error.message } };
  }
  
  if (error instanceof ForbiddenError) {
    return { statusCode: 403, body: { error: error.message } };
  }
  
  if (error instanceof NotFoundError) {
    return { statusCode: 404, body: { error: error.message } };
  }

  // Errores puros de validación de entidad en la capa de Domain
  if (error instanceof TopologyDomainError) {
    return { statusCode: 400, body: { error: error.message } };
  }

  // Fallo subyacente de I/O, BD, red, o excepción no controlada (NFR-05)
  // En un sistema real se registraría el log (LoggerService) aquí.
  return { 
    statusCode: 500, 
    body: { error: 'Internal Server Error' } 
  };
}
