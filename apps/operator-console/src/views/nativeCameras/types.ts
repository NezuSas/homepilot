export type NativeCameraSourceType = 'onvif-ptz' | 'rtsp-dvr' | 'sonoff-rtsp';

export interface NativeCamera {
  deviceId: string;
  homeId: string;
  sourceType: NativeCameraSourceType;
  name: string;
  host: string;
  onvifPort: number;
  rtspPort: number;
  rtspPath: string;
  enabled: boolean;
  createdAt: string;
}

export interface DiscoveredCamera {
  urn: string;
  name: string;
  host: string;
  onvifPort: number;
}

export interface NativeCameraPayload {
  sourceType: NativeCameraSourceType;
  name: string;
  host: string;
  rtspPort: number;
  onvifPort: number;
  rtspPath: string;
  username?: string;
  password?: string;
  homeId?: string;
}

export interface NativeCameraFormData {
  sourceType: NativeCameraSourceType;
  name: string;
  host: string;
  rtspPort: number;
  onvifPort: number;
  username: string;
  password: string;
  rtspPath: string;
  homeId: string;
}

export const sourceTypeDefaults: Record<NativeCameraSourceType, { rtspPort: number; onvifPort: number; rtspPath: string }> = {
  'onvif-ptz': { rtspPort: 554, onvifPort: 8000, rtspPath: '' },
  'rtsp-dvr': { rtspPort: 554, onvifPort: 80, rtspPath: '' },
  'sonoff-rtsp': { rtspPort: 554, onvifPort: 80, rtspPath: '/av_stream/ch0' },
};
