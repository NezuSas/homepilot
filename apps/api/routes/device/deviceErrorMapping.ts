/**
 * Mapeo puro de errores de dominio a respuestas HTTP para las rutas de dispositivos.
 * `name` es el nombre del constructor del error y `message` su mensaje.
 */
export interface MappedDeviceError {
  readonly status: number;
  readonly code: string;
}

export function mapAssignError(name: string, msg: string): MappedDeviceError {
  if (name === 'DeviceNotFoundError' || name === 'TopologyResourceNotFoundError') return { status: 404, code: 'DEVICE_NOT_FOUND' };
  if (name === 'ForbiddenOwnershipError') return { status: 403, code: 'FORBIDDEN' };
  if (name === 'DeviceAlreadyAssignedError' || msg.includes('already assigned')) return { status: 409, code: 'ALREADY_ASSIGNED' };
  return { status: 500, code: 'ASSIGN_ERROR' };
}

export function mapCommandError(name: string): MappedDeviceError {
  if (name === 'DeviceNotFoundError' || name === 'TopologyResourceNotFoundError') return { status: 404, code: 'DEVICE_NOT_FOUND' };
  if (name === 'ForbiddenOwnershipError') return { status: 403, code: 'FORBIDDEN' };
  if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') return { status: 400, code: 'INVALID_COMMAND' };
  if (name === 'DispatchIntegrationError') return { status: 502, code: 'COMMAND_DISPATCH_FAILED' };
  return { status: 500, code: 'COMMAND_ERROR' };
}

export function mapActionExecuteError(name: string, message: string): MappedDeviceError {
  if (name === 'ForbiddenOwnershipError') return { status: 403, code: 'FORBIDDEN' };
  if (name === 'DeviceNotFoundError' || name === 'TopologyResourceNotFoundError') return { status: 404, code: 'DEVICE_NOT_FOUND' };
  if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError' || message === 'INVALID_JSON') {
    return { status: 400, code: 'INVALID_COMMAND' };
  }
  if (name === 'IntentFlowCommandError' && message === 'INTENTFLOW_COMMAND_FORBIDDEN') return { status: 403, code: 'FORBIDDEN' };
  if (name === 'IntentFlowCommandError' && message === 'INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE') return { status: 400, code: 'DISPLAY_OFFLINE' };
  if (name === 'IntentFlowCommandError' && message === 'INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED') {
    return { status: 409, code: 'COMMAND_CONFIRMATION_REQUIRED' };
  }
  if (name === 'IntentFlowCommandError' && message === 'INTENTFLOW_COMMAND_ROUTE_MISMATCH') return { status: 502, code: 'COMMAND_ROUTE_MISMATCH' };
  if (name === 'IntentFlowCommandError' || name === 'DirectoryTokenError' || name === 'CommandTokenCacheError') {
    return { status: 502, code: 'COMMAND_DISPATCH_FAILED' };
  }
  if (name === 'DispatchIntegrationError') return { status: 502, code: 'COMMAND_DISPATCH_FAILED' };
  return { status: 500, code: 'COMMAND_ERROR' };
}

export function mapHaImportError(msg: string): MappedDeviceError {
  if (msg === 'DEVICE_ALREADY_EXISTS') return { status: 409, code: 'DEVICE_ALREADY_EXISTS' };
  if (msg === 'HOME_NOT_FOUND') return { status: 404, code: 'HOME_NOT_FOUND' };
  if (msg === 'HA_ENTITY_NOT_FOUND') return { status: 404, code: 'HA_ENTITY_NOT_FOUND' };
  return { status: 500, code: 'IMPORT_ERROR' };
}

export function mapDeviceReadError(name: string): MappedDeviceError {
  if (name === 'DeviceNotFoundError' || name === 'TopologyResourceNotFoundError') return { status: 404, code: 'DEVICE_NOT_FOUND' };
  if (name === 'ForbiddenOwnershipError') return { status: 403, code: 'FORBIDDEN' };
  return { status: 500, code: 'INTERNAL_ERROR' };
}
