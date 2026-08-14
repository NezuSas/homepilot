import type { NativeCameraSourceType } from '../../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriver } from './NativeCameraDriver';

export interface NativeCameraDriverRegistry {
  resolve(sourceType: NativeCameraSourceType): NativeCameraDriver;
  /** Drivers that can enumerate devices on the LAN by themselves. */
  discoverableDrivers(): ReadonlyArray<NativeCameraDriver>;
}
