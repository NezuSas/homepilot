export interface NativeCameraSource {
  readonly deviceId: string;
  readonly host: string;
  readonly rtspPort: number;
  readonly username: string;
  readonly password: string;
  readonly rtspPath: string;
  readonly enabled: boolean;
}

/**
 * Puerto de persistencia para la configuración local de cámaras RTSP.
 */
export interface NativeCameraSourceRepository {
  findByDeviceId(deviceId: string): NativeCameraSource | null;
}