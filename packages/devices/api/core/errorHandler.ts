import { HttpResponse } from '../../../topology/api/core/http';
import { DeviceDomainError, UnsupportedCommandError } from '../../domain/errors';
import { 
  DeviceApplicationError, 
  DeviceNotFoundError, 
  ForbiddenOwnershipError, 
  DeviceConflictError,
  TopologyResourceNotFoundError,
  DevicePendingStateError,
  DispatchIntegrationError
} from '../../application/errors';

/**
 * Mapeador central de excepciones para el módulo Devices.
 * Traduce errores inmutables de Dominio y Aplicación a semántica REST HTTP estandarizada.
 * Aísla lógicas transaccionales de los frameworks expresivos.
 */
export function handleError(error: unknown): HttpResponse {
  if (error instanceof DeviceConflictError || error instanceof DevicePendingStateError) {
    return {
      statusCode: 409,
      body: { error: 'Conflict', message: error.message }
    };
  }

  // Comprobación de tipos resolviendo polimórficamente los origenes nulos
  if (error instanceof DeviceNotFoundError || error instanceof TopologyResourceNotFoundError) {
    return {
      statusCode: 404,
      body: { error: 'Not Found', message: error.message }
    };
  }

  if (error instanceof ForbiddenOwnershipError) {
    return {
      statusCode: 403,
      body: { error: 'Forbidden', message: error.message }
    };
  }

  if (error instanceof DispatchIntegrationError) {
    return {
      statusCode: 502,
      body: { error: 'Bad Gateway', message: error.message }
    };
  }

  // Traducción a BadRequest para violaciones genéricas contractuales o incompatibilidad de hardware
  if (
    error instanceof UnsupportedCommandError || 
    error instanceof DeviceDomainError || 
    error instanceof DeviceApplicationError
  ) {
    return {
      statusCode: 400,
      body: { error: 'Bad Request', message: error.message }
    };
  }

  // Errores exógenos no controlados puramente arrojados por red o memoria fallida
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  
  return {
    statusCode: 500,
    body: { error: 'Internal Server Error', message }
  };
}
