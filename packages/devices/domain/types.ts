import { DeviceCapability } from './capabilities';

/**
 * Interfaces y Tipos originados puramente sobre el Dominio de Devices.
 */

export type DeviceStatus = 'PENDING' | 'ASSIGNED';

export type DeviceSemanticType = 'light' | 'switch' | 'outlet' | 'cover' | 'sensor' | 'unknown';

export interface Device {
  readonly id: string;
  readonly homeId: string;
  readonly roomId: string | null;
  readonly externalId: string;
  readonly name: string;
  readonly type: string;
  readonly vendor: string;
  readonly status: DeviceStatus;
  readonly integrationSource: string;
  readonly invertState: boolean;
  readonly lastKnownState: Record<string, unknown> | null;
  readonly capabilities?: ReadonlyArray<DeviceCapability>;
  readonly entityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * Optional operator-assigned semantic classification.
   * null/undefined means automatic/unset (reverts to device.type heuristics).
   * Persisted in SQLite via semantic_type column.
   * Assistant uses this field for deterministic intent resolution (e.g., lights).
   * Takes priority over device.type in isLightEntity resolution.
   */
  readonly semanticType?: DeviceSemanticType | null;
}
