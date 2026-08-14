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
  /** ONVIF media profile token chosen at negotiation time; null for non-ONVIF sources. */
  readonly profileToken: string | null;
  /** ONVIF PTZ configuration token, if the negotiated profile advertised one. */
  readonly ptzConfigurationToken: string | null;
  /** Whether the negotiated profile supports PTZ continuous move (Phase 3). */
  readonly ptzSupported: boolean;
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