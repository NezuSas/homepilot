import { DeviceCapability } from './capabilities';

/**
 * Interfaces y Tipos originados puramente sobre el Dominio de Devices.
 */

export type DeviceStatus = 'PENDING' | 'ASSIGNED';

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
   * Optional user-assigned semantic classification.
   * Takes priority over device.type in isLightEntity resolution.
   * Useful for HA-imported devices reported as 'switch' that are physically lights.
   * TODO: Add UI classification control in operator-console DeviceDetail panel.
   * TODO: Persist via DeviceRepository.saveDevice when schema migration is ready.
   */
  readonly semanticType?: 'light' | 'switch' | 'outlet' | 'cover' | 'sensor' | 'unknown';
}
