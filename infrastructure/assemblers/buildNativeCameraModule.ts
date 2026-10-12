/**
 * buildNativeCameraModule.ts
 *
 * Assembler: construcción del módulo de cámaras nativas (ONVIF, RTSP/DVR,
 * Sonoff-RTSP). Compone los drivers por protocolo, el registro de drivers, el
 * transcodificador ffmpeg y los dos servicios de aplicación consumidos por
 * `NativeCameraRoutes`/`CameraRoutes`.
 */
import { NativeCameraService } from '../../packages/integrations/native-camera/application/NativeCameraService';
import { NativeCameraConnectionTester } from '../../packages/integrations/native-camera/application/NativeCameraConnectionTester';
import { NativeCameraStreamingService } from '../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { TcpNetworkProbe } from '../../packages/integrations/native-camera/infrastructure/TcpNetworkProbe';
import { OnvifWsDiscoveryProbe } from '../../packages/integrations/native-camera/infrastructure/onvif/OnvifWsDiscoveryProbe';
import { OnvifPtzCameraDriver } from '../../packages/integrations/native-camera/infrastructure/drivers/OnvifPtzCameraDriver';
import { RtspDvrCameraDriver } from '../../packages/integrations/native-camera/infrastructure/drivers/RtspDvrCameraDriver';
import { SonoffRtspCameraDriver } from '../../packages/integrations/native-camera/infrastructure/drivers/SonoffRtspCameraDriver';
import { DefaultNativeCameraDriverRegistry } from '../../packages/integrations/native-camera/infrastructure/drivers/DefaultNativeCameraDriverRegistry';
import { FfmpegMediaTranscoder } from '../../packages/integrations/native-camera/infrastructure/FfmpegMediaTranscoder';

import type { NativeCameraDriverRegistry } from '../../packages/integrations/native-camera/application/ports/NativeCameraDriverRegistry';
import type { SQLiteNativeCameraSourceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteNativeCameraSourceRepository';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';

export interface NativeCameraAssembly {
  nativeCameraService: NativeCameraService;
  nativeCameraStreamingService: NativeCameraStreamingService;
  nativeCameraConnectionTester: NativeCameraConnectionTester;
  /** Exposed so buildCommandRouter can register NativeCameraDeviceDriver against the same drivers. */
  nativeCameraDriverRegistry: NativeCameraDriverRegistry;
}

export interface NativeCameraModuleDeps {
  nativeCameraSourceRepository: SQLiteNativeCameraSourceRepository;
  deviceRepository: SQLiteDeviceRepository;
  homeRepository: SQLiteHomeRepository;
}

export function buildNativeCameraModule(deps: NativeCameraModuleDeps): NativeCameraAssembly {
  const { nativeCameraSourceRepository, deviceRepository, homeRepository } = deps;

  const networkProbe = new TcpNetworkProbe();
  const driverRegistry = new DefaultNativeCameraDriverRegistry([
    new OnvifPtzCameraDriver(new OnvifWsDiscoveryProbe(), networkProbe),
    new RtspDvrCameraDriver(networkProbe),
    new SonoffRtspCameraDriver(networkProbe),
  ]);

  const nativeCameraService = new NativeCameraService(
    nativeCameraSourceRepository,
    deviceRepository,
    homeRepository,
    driverRegistry
  );

  const transcoder = new FfmpegMediaTranscoder();
  const nativeCameraStreamingService = new NativeCameraStreamingService(transcoder);
  const nativeCameraConnectionTester = new NativeCameraConnectionTester(driverRegistry, transcoder);

  return { nativeCameraService, nativeCameraStreamingService, nativeCameraConnectionTester, nativeCameraDriverRegistry: driverRegistry };
}
