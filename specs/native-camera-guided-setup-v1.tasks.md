# Tareas: Alta guiada de cámaras IP con prueba real V1

## Implementación

- [x] REQ-01/REQ-02: `FfmpegFrameProbe.ts` (captura un fotograma con `ffmpeg`, clasifica el fallo y lee
      códec y resolución), `rtspUrl.ts` (construcción de la URL RTSP compartida con el transcodificador),
      `MediaTranscoderPort.captureFrame` y `FfmpegMediaTranscoder.captureFrame`.
- [x] REQ-01/REQ-03: `NativeCameraConnectionTester.ts` — valida la entrada, negocia ONVIF, captura el
      fotograma y traduce cada fallo a mensaje y pista sin secretos.
- [x] REQ-01: ruta `POST /api/v1/native-cameras/test` en `NativeCameraRoutes.ts` (solo `admin`, no
      persiste); `buildNativeCameraModule`, `buildBootstrapContainer` y `bootstrapTypes` exponen
      `services.nativeCameraConnectionTester`.
- [x] REQ-05/REQ-06: `cameraBrandPresets.ts` y `parseRtspUrl.ts` en `views/nativeCameras`.
- [x] REQ-04/REQ-07/REQ-08: asistente `NativeCameraWizardModal` con `WizardChooseStep`,
      `WizardDetailsStep`, `WizardTestStep`, `useNativeCameraWizard` y `nativeCameraApi`; sustituye al
      modal de descubrimiento (eliminados `NativeCameraDiscoveryModal` y `useNativeCameraDiscovery`).
- [x] Claves `native_cameras.wizard.*` en `es` y `en`; se retiran las de `native_cameras.discovery`.

## Verificación

- [x] AC1: `FfmpegFrameProbe.test.ts`.
- [x] AC2: `NativeCameraConnectionTester.test.ts`.
- [x] AC3: `NativeCameraTestRoute.test.ts`.
- [x] AC4: `parseRtspUrl.test.ts` y plantillas cubiertas por el e2e.
- [x] AC5: `devices-spaces.spec.ts` (dos escenarios del asistente) y `system-views.spec.ts`.
- [x] AC6: suite completa, `verify:quality`.
