/**
 * Interfaz agnóstica para solicitudes HTTP base.
 */
export interface HttpRequest {
  readonly body?: unknown;
  readonly query?: Record<string, string>;
  readonly params?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly userId?: string;
}

/**
 * Interfaz derivada que garantiza estructuralmente el cumplimiento 
 * de la política de autorización Zero-Trust para endpoints cerrados.
 */
export interface AuthenticatedHttpRequest extends HttpRequest {
  readonly userId: string;
}

/**
 * Interfaz agnóstica para respuestas HTTP serializadas.
 */
export interface HttpResponse {
  readonly statusCode: number;
  readonly body?: unknown;
}
