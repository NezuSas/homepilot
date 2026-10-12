import type { NativeCameraSourceType } from './types';

export type CameraBrandId = 'hikvision' | 'dahua' | 'reolink' | 'tapo' | 'axis' | 'sonoff' | 'other';

export interface CameraBrandPreset {
  id: CameraBrandId;
  sourceType: NativeCameraSourceType;
  rtspPort: number;
  onvifPort: number;
  rtspPath: string;
}

/**
 * Common starting points per brand. They are suggestions: the connection test is what decides,
 * so every value stays editable in the wizard.
 */
export const CAMERA_BRAND_PRESETS: readonly CameraBrandPreset[] = [
  { id: 'hikvision', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 80, rtspPath: '/Streaming/Channels/101' },
  { id: 'dahua', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 80, rtspPath: '/cam/realmonitor?channel=1&subtype=0' },
  { id: 'reolink', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 8000, rtspPath: '/h264Preview_01_main' },
  { id: 'tapo', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 2020, rtspPath: '/stream1' },
  { id: 'axis', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 80, rtspPath: '/axis-media/media.amp' },
  { id: 'sonoff', sourceType: 'sonoff-rtsp', rtspPort: 554, onvifPort: 80, rtspPath: '/av_stream/ch0' },
  { id: 'other', sourceType: 'rtsp-dvr', rtspPort: 554, onvifPort: 80, rtspPath: '' },
];

export function findBrandPreset(id: CameraBrandId): CameraBrandPreset {
  return CAMERA_BRAND_PRESETS.find(preset => preset.id === id) ?? CAMERA_BRAND_PRESETS[CAMERA_BRAND_PRESETS.length - 1];
}
