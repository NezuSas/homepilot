import type { Device } from '../../../../packages/devices/domain/types';

export type CameraMediaKind = 'snapshot' | 'stream';

/** Resuelve la entidad de cámara de un dispositivo (`native` para cámaras nativas, entity_id para HA). */
export function resolveCameraEntityId(device: Device | null): string | null {
  if (!device) return null;
  if (device.integrationSource === 'native-camera' && device.type === 'camera') return 'native';
  if (!device.externalId.startsWith('ha:camera.')) return null;
  return device.externalId.slice(3);
}

/** Ruta de respaldo cuando la solicitud no trae URL. */
export function pathnameFallback(kind: CameraMediaKind | 'stream', deviceId: string): string {
  return `/api/v1/devices/${encodeURIComponent(deviceId)}/camera/${kind}`;
}

/** Rutas públicas (con token) que devuelve el endpoint de sesión de cámara. */
export function buildCameraMediaPaths(deviceId: string, token: string) {
  const encodedDeviceId = encodeURIComponent(deviceId);
  const encodedToken = encodeURIComponent(token);
  return {
    snapshotPath: `/api/v1/devices/${encodedDeviceId}/camera/snapshot?token=${encodedToken}`,
    streamPath: `/api/v1/devices/${encodedDeviceId}/camera/stream?token=${encodedToken}`,
    hlsPath: `/api/v1/devices/${encodedDeviceId}/camera/hls/master.m3u8?token=${encodedToken}`,
  };
}
