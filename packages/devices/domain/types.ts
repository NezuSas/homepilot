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
  readonly entityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
