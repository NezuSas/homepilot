import type { Device, DeviceSemanticType } from '../../../../packages/devices/domain/types';

const ACCEPTED_SEMANTIC_TYPES: ReadonlyArray<string> = [
  'light', 'switch', 'outlet', 'cover', 'camera', 'sensor', 'button', 'smart_display', 'unknown',
];

/** Valida el valor de `semanticType` recibido en el cuerpo (null o un tipo conocido). */
export function isAcceptedSemanticType(value: unknown): value is DeviceSemanticType | null {
  return value === null || (typeof value === 'string' && ACCEPTED_SEMANTIC_TYPES.includes(value));
}

/**
 * Reglas Android Display para el tipo semántico. Devuelve el mensaje de error
 * de validación o null si la combinación dispositivo/tipo es válida.
 */
export function semanticTypeConflict(
  integrationSource: Device['integrationSource'],
  semanticType: DeviceSemanticType | null,
): string | null {
  if (integrationSource === 'android-display' && semanticType !== 'smart_display') {
    return 'Smart Display semantic type is fixed';
  }
  if (integrationSource !== 'android-display' && semanticType === 'smart_display') {
    return 'Smart Display semantic type requires Android Display';
  }
  return null;
}

export interface DevicePatchInput {
  readonly name?: string;
  readonly invertState?: boolean;
}

/** Calcula los valores resultantes de un PATCH de nombre / inversión de estado. */
export function resolveDevicePatch(device: Pick<Device, 'name' | 'invertState'>, payload: DevicePatchInput) {
  const name = typeof payload.name === 'string' && payload.name.trim().length > 0
    ? payload.name.trim()
    : device.name;
  const invertState = typeof payload.invertState === 'boolean'
    ? payload.invertState
    : device.invertState;
  return { name, invertState, changed: !(name === device.name && invertState === device.invertState) };
}
