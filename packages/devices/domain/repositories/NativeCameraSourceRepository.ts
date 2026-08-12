export type NativeCameraSourceType = 'onvif-ptz' | 'rtsp-dvr' | 'sonoff-rtsp';

export interface NativeCameraSource {
  readonly deviceId: string;
  readonly homeId: string;
  readonly sourceType: NativeCameraSourceType;
  readonly name: string;
  readonly host: string;
  readonly onvifPort: number;
  readonly rtspPort: number;
  readonly username: string;
  readonly password: string;
  readonly rtspPath: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Puerto de persistencia para la configuración local de cámaras RTSP.
 */
export interface NativeCameraSourceRepository {
  findByDeviceId(deviceId: string): NativeCameraSource | null;
  findByHomeId(homeId: string): ReadonlyArray<NativeCameraSource>;
  findDuplicate(homeId: string, host: string, rtspPort: number, rtspPath: string, excludedDeviceId?: string): NativeCameraSource | null;
  save(source: NativeCameraSource): void;
}