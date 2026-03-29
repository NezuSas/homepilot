import { HttpRequest, AuthenticatedHttpRequest, HttpResponse } from '../core/http';

export type RequestHandler = (req: HttpRequest) => Promise<HttpResponse>;
export type AuthenticatedRequestHandler = (req: AuthenticatedHttpRequest) => Promise<HttpResponse>;

/**
 * Middleware (Guard) genérico que asegura la existencia de identidad en la petición.
 * Implementa el NFR-07 (Contexto Requerido) rechazando peticiones anónimas perimetralmente.
 */
export function requireAuth(next: AuthenticatedRequestHandler): RequestHandler {
  return async (req: HttpRequest): Promise<HttpResponse> => {
    // Escaneo de cabecera customizada simulando extracción JWT en app real
    const rawUserId = req.headers?.['x-user-id'] ?? req.userId;

    if (typeof rawUserId !== 'string' || rawUserId.trim() === '') {
      return {
        statusCode: 401,
        body: { error: 'Unauthorized: Missing User Context' }
      };
    }

    // Inyectamos constructivamente en el nuevo tipo seguro AuthenticatedHttpRequest
    const authenticatedReq: AuthenticatedHttpRequest = { 
      ...req, 
      userId: rawUserId.trim() 
    };
    
    // Delegamos al siguiente eslabón lógicamente tipeado
    return next(authenticatedReq);
  };
}
