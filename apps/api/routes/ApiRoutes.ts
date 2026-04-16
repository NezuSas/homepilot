import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { RouteHandler } from '../RouteHandler';

/**
 * Safe messages map — sanitizes error details sent to clients.
 */
const SAFE_MESSAGES: Record<string, string> = {
  'AUTH_FAILED': 'Credenciales inválidas o cuenta desactivada.',
  'UNAUTHORIZED': 'Sesión inválida o expirada.',
  'FORBIDDEN': 'No tiene permisos para realizar esta acción.',
  'NOT_FOUND': 'El recurso solicitado no existe.',
  'VALIDATION_ERROR': 'Los datos proporcionados no son válidos.',
  'HA_CONNECTION_ERROR': 'Error de comunicación con Home Assistant.',
  'HA_AUTH_ERROR': 'Error de autenticación con Home Assistant.',
  'INTERNAL_ERROR': 'Error interno del sistema. Contacte a soporte.',
  'SETUP_REQUIRED': 'El sistema requiere configuración inicial.',
  'ALREADY_INITIALIZED': 'El sistema ya ha sido configurado.',
  'DEVICE_ALREADY_EXISTS': 'El dispositivo ya fue importado.',
  'HA_DISCOVERY_ERROR': 'No se pudo consultar Home Assistant. Verifica la conexión y la configuración.',
};

const DEFAULT_STATUS_CODES: Record<string, number> = {
  'AUTH_FAILED': 401,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403,
  'NOT_FOUND': 404,
  'VALIDATION_ERROR': 400,
  'HA_CONNECTION_ERROR': 502,
  'HA_AUTH_ERROR': 502,
  'INTERNAL_ERROR': 500,
  'DEVICE_ALREADY_EXISTS': 409,
  'HA_DISCOVERY_ERROR': 502,
};

/**
 * Base class for route handlers providing shared HTTP utilities.
 */
export abstract class ApiRoutes implements RouteHandler {
  abstract handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean>;

  protected parseBody<T>(req: http.IncomingMessage): Promise<T> {
    // Fastify pre-buffers request bodies and attaches them to request.raw via
    // _fastifyParsedBody (set in ApiGateway.registerCatchAllRoute).
    // Reading from this property avoids re-consuming the already-drained stream.
    const fastifyBody = (req as unknown as Record<string, unknown>)['_fastifyParsedBody'];
    if (fastifyBody !== undefined) {
      try {
        return Promise.resolve(JSON.parse((fastifyBody as string) || '{}') as T);
      } catch {
        return Promise.reject(new Error('INVALID_JSON'));
      }
    }

    // Fallback: stream-based reading for non-Fastify contexts (e.g. unit tests).
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}') as T);
        } catch {
          reject(new Error('INVALID_JSON'));
        }
      });
    });
  }

  protected sendJson(res: http.ServerResponse, data: any, status: number = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  protected sendError(
    res: http.ServerResponse,
    status: number,
    code: string,
    internalMessage?: string
  ): void {
    const safeMessage = SAFE_MESSAGES[code] || SAFE_MESSAGES['INTERNAL_ERROR'];
    const finalStatus = status || DEFAULT_STATUS_CODES[code] || 500;

    if (internalMessage) {
      console.error(`[API-ERROR] [${code}] ${internalMessage}`);
    }

    res.writeHead(finalStatus, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          code,
          message: safeMessage,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}
