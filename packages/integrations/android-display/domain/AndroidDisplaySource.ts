import type { Device } from '../../../devices/domain/types';

export type AndroidDisplayConnectionState = 'online' | 'offline' | 'needs_authorization' | 'identity_mismatch';
export type AndroidDisplayScreenState = 'awake' | 'asleep' | 'dozing' | 'unknown';

export interface AndroidDisplayMetadata {
  readonly adbSerial: string | null;
  readonly androidId: string | null;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly androidVersion: string | null;
  readonly resolution: string | null;
  readonly densityDpi: number | null;
  readonly screenState: AndroidDisplayScreenState;
}

export interface AndroidDisplaySource {
  readonly deviceId: string;
  readonly homeId: string;
  readonly adbHost: string;
  readonly adbPort: 5555;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly connectionState: AndroidDisplayConnectionState;
  readonly lastSeenAt: string | null;
  readonly metadata: AndroidDisplayMetadata;
}

export interface AndroidDisplaySourceRepository {
  findByDeviceId(deviceId: string): AndroidDisplaySource | null;
  findByEndpoint(host: string, port: number): AndroidDisplaySource | null;
  findByAndroidId(androidId: string): AndroidDisplaySource | null;
  listByHomeId(homeId: string): ReadonlyArray<AndroidDisplaySource>;
  createWithDevice(device: Device, source: AndroidDisplaySource): void;
  updateObservation(source: AndroidDisplaySource): void;
}
