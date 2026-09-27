import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { RouteHandler } from '../RouteHandler';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { logRuntimeDiagnostic } from '../../../packages/shared/config/runtimeEnvironment';

import { ActivityType } from '../../../packages/devices/domain/repositories/ActivityLogRepository';

/**
 * Safe messages map — sanitizes error details sent to clients.
 */
const SAFE_MESSAGES: Record<string, string> = {
  'AUTH_FAILED': 'Credenciales inválidas o cuenta desactivada.',
  'AUTH_RATE_LIMITED': 'Demasiados intentos. Espere unos minutos antes de volver a intentarlo.',
  'SSO_TOKEN_INVALID': 'No se pudo validar el acceso desde el Directorio. Solicita uno nuevo.',
  'SSO_TOKEN_EXPIRED': 'El acceso desde el Directorio expiró. Vuelve a iniciarlo.',
  'SSO_TOKEN_REPLAYED': 'Este acceso desde el Directorio ya fue utilizado. Solicita uno nuevo.',
  'SSO_TOKEN_HOME_MISMATCH': 'Este acceso desde el Directorio no corresponde a este hogar.',
  'SSO_NOT_CONFIGURED': 'El acceso desde el Directorio no está disponible en este hogar.',
  'SSO_HANDOFF_INVALID': 'No se pudo completar el acceso desde el Directorio. Vuelve a iniciarlo.',
  'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED': 'Este HomePilot no está vinculado al Directorio.',
  'INSTALLATION_VERIFICATION_INPUT_INVALID': 'Los datos de verificación no son válidos.',
  'INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE': 'El Directorio no está disponible en este momento.',
  'INSTALLATION_VERIFICATION_DIRECTORY_REJECTED': 'El Directorio rechazó la solicitud de verificación.',
  'INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID': 'El Directorio devolvió una respuesta de verificación no válida.',
  'INSTALLATION_VERIFICATION_TIMEOUT': 'El Directorio tardó demasiado en responder.',
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
  'ALREADY_ASSIGNED': 'El dispositivo ya tiene una habitación asignada.',
  'DEVICE_NOT_FOUND': 'Dispositivo no encontrado.',
  'DEVICE_IN_USE': 'El dispositivo está siendo utilizado por una escena o automatización.',
  'DISPLAY_NOT_FOUND': 'Pantalla no encontrada.',
  'DISPLAY_ALREADY_EXISTS': 'Esta pantalla ya está registrada.',
  'DISPLAY_DISABLED': 'La pantalla está deshabilitada.',
  'DISPLAY_NEEDS_AUTHORIZATION': 'Autoriza la conexión ADB en la pantalla y vuelve a intentarlo.',
  'DISPLAY_OFFLINE': 'La pantalla no está disponible.',
  'INVALID_ADB_ENDPOINT': 'La dirección o el puerto de la pantalla no son válidos.',
  'ADB_ENDPOINT_NOT_ALLOWED': 'La dirección de la pantalla no está autorizada.',
  'ADB_OFFLINE': 'La pantalla no está disponible.',
  'ADB_TIMEOUT': 'La pantalla tardó demasiado en responder.',
  'BRIDGE_TIMEOUT': 'La conexión con la pantalla tardó demasiado.',
  'BRIDGE_BUSY': 'El servicio de pantallas está ocupado. Inténtalo de nuevo.',
  'DISPLAY_BUSY': 'La pantalla está ocupada. Inténtalo de nuevo.',
  'BRIDGE_NOT_CONFIGURED': 'El servicio de pantallas no está configurado.',
  'BRIDGE_UNAVAILABLE': 'El servicio de pantallas no está disponible.',
  'DISPLAY_NOT_CONNECTED': 'La pantalla no está conectada.',
  'COMMAND_DISPATCH_FAILED': 'No se pudo ejecutar el comando en el dispositivo.',
  'INVALID_TYPE': 'Tipo de dispositivo no compatible para esta operación.',
  'INVALID_COMMAND': 'Comando no válido para este dispositivo.',
  'AUTOMATION_ERROR': 'Error en la gestión de automatizaciones.',
  'REFRESH_ERROR': 'No se pudo actualizar el estado desde Home Assistant.',
  'TTS_UNAVAILABLE': 'La voz profesional gratuita no está disponible.',
  'ASSISTANT_TTS_ERROR': 'No se pudo generar la respuesta hablada.',
  'STT_UNAVAILABLE': 'La transcripción de voz local no está disponible.',
  'HOME_NOT_FOUND': 'Hogar no encontrado.',
  'SINGLE_HOME_INSTALLATION': 'La instalación debe tener exactamente un hogar configurado.',
  'HA_ENTITY_NOT_FOUND': 'Entidad de Home Assistant no encontrada.',
  'CAMERA_UNAVAILABLE': 'La camara no esta disponible en este momento.',
  'CAMERA_MEDIA_ERROR': 'No se pudo obtener el video de la camara.',
  'CAMERA_CONNECTION_FAILED': 'No se pudo conectar a la cámara con las credenciales proporcionadas.',
  'NATIVE_CAMERA_AUTH_FAILED': 'Las credenciales de la cámara son incorrectas. Verifica usuario y contraseña RTSP.',
  'NATIVE_CAMERA_STREAM_TIMEOUT': 'La cámara tardó demasiado en responder. Verifica que esté encendida y que el path RTSP sea correcto.',
  'AUTOMATIONLOOPERROR': 'Se detectó un bucle infinito en la automatización.',
  'INVALIDAUTOMATIONRULEERROR': 'Regla de automatización inválida.',
  'DASHBOARD_IMPORT_INVALID': 'El archivo de tablero no es válido.',
  'DASHBOARD_IMPORT_UNSUPPORTED_VERSION': 'La versión del archivo de tablero no es compatible.',
  'DASHBOARD_NOT_FOUND': 'El tablero no existe.',
  'DASHBOARD_REVISION_NOT_FOUND': 'La versión del historial no existe.',
};

const DEFAULT_STATUS_CODES: Record<string, number> = {
  'AUTH_FAILED': 401,
  'AUTH_RATE_LIMITED': 429,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403,
  'NOT_FOUND': 404,
  'VALIDATION_ERROR': 400,
  'HA_CONNECTION_ERROR': 502,
  'HA_AUTH_ERROR': 502,
  'INTERNAL_ERROR': 500,
  'DEVICE_ALREADY_EXISTS': 409,
  'HA_DISCOVERY_ERROR': 502,
  'DASHBOARD_IMPORT_INVALID': 400,
  'DASHBOARD_IMPORT_UNSUPPORTED_VERSION': 400,
  'DASHBOARD_NOT_FOUND': 404,
  'DASHBOARD_REVISION_NOT_FOUND': 404,
  'SINGLE_HOME_INSTALLATION': 409,
};

/**
 * Base class for route handlers providing shared HTTP utilities.
 */
export abstract class ApiRoutes implements RouteHandler {
  abstract handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean>;

  protected parseBody<T>(req: HomePilotRequest): Promise<T> {
    // Fastify pre-buffers request bodies and attaches them to request.raw via
    // _fastifyParsedBody (set in ApiGateway.registerCatchAllRoute).
    if (req._fastifyParsedBody !== undefined) {
      try {
        return Promise.resolve(JSON.parse(req._fastifyParsedBody || '{}') as T);
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

  protected sendJson(res: http.ServerResponse, data: unknown, status: number = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Normalizes unknown thrown values before route handlers map them to HTTP errors.
   * This preserves domain error names while keeping route boundaries type-safe.
   */
  protected getErrorDetails(error: unknown): { name: string; message: string } {
    if (error instanceof Error) {
      return { name: error.constructor.name, message: error.message };
    }

    return { name: 'UnknownError', message: String(error) };
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
      logRuntimeDiagnostic('error', `[API-ERROR] [${code}] ${internalMessage}`);
    }

    res.writeHead(finalStatus, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          code,
          message: process.env.NODE_ENV === 'test' && internalMessage ? internalMessage : safeMessage,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}
