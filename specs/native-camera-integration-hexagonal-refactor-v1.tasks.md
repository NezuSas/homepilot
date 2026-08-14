# Tareas: Native Camera Integration Hexagonal Refactor V1

## Implementación

- [x] AC2/AC3/AC4: Nuevo paquete `packages/integrations/native-camera/` — puertos
      (`NativeCameraDriver`, `NativeCameraDriverRegistry`, `NetworkProbePort`, `MediaTranscoderPort`),
      drivers (`OnvifPtzCameraDriver`, `RtspDvrCameraDriver`, `SonoffRtspCameraDriver`,
      `DefaultNativeCameraDriverRegistry`), `OnvifWsDiscoveryProbe` (movido verbatim),
      `TcpNetworkProbe`, `FfmpegMediaTranscoder`, `NativeCameraService`,
      `NativeCameraStreamingService`.
- [x] `infrastructure/assemblers/buildNativeCameraModule.ts` nuevo; `bootstrap.ts` lo invoca y expone
      `container.services.nativeCameraService`/`nativeCameraStreamingService`.
- [x] `apps/api/routes/NativeCameraRoutes.ts` y `apps/api/routes/CameraRoutes.ts` reducidos a
      adaptadores HTTP delgados; `apps/api/OperatorConsoleServer.ts` actualizado para inyectar los
      nuevos servicios en vez del repositorio crudo.
- [x] `apps/api/OnvifDiscovery.ts` eliminado.
- [x] `scripts/check-spec-coverage.mjs` — regla de `native-camera-local-integration-v1.md` ampliada
      a `/(?:NativeCamera|Onvif|integrations\/native-camera)/i`.
- [x] `docs/spec-coverage-matrix.md` — conteo actualizado de 583 a 599 (14 archivos de producción
      nuevos, 3 archivos de test nuevos, 1 archivo eliminado).
- [x] `specs/native-camera-local-integration-v1.md` — sección "Arquitectura" actualizada para
      reflejar el nuevo paquete.

## Verificación

- [x] AC1: `apps/api/__tests__/NativeCameraRoutes.test.ts` reescrito solo en el wiring (SQLite real +
      `NativeCameraService` con un `NetworkProbePort` stub en vez del monkey-patch de
      `checkTcpReachable`) — las 4 aserciones de comportamiento quedan idénticas.
      `apps/api/__tests__/CameraRoutes.test.ts` sin cambios (solo ejercita la rama Home Assistant).
- [x] Tests nuevos: `NativeCameraService.test.ts` (10 casos: validación, home inexistente, ONVIF no
      autorizado, TCP inalcanzable, aislamiento entre protocolos, rtspPath obligatorio, duplicados,
      creación de dispositivo PENDING, descubrimiento agregado solo de drivers descubribles,
      eliminación con cascada), `NativeCameraStreamingService.test.ts` (4 casos: traducción de
      endpoint para HLS/snapshot/MJPEG, delegación de stop), `OnvifWsDiscoveryProbe.test.ts` (6 casos:
      parseo de ProbeMatch/Hello, fallback de nombre, fallback de host/puerto, filtro de no-ONVIF,
      payload irrelevante).
- [x] AC2: `npx jest` — 148 suites, 1234 tests, sin regresiones.
- [x] AC3: `check:architecture-boundaries`, `check:no-production-any`, `check:bdd-traceability`,
      `check:module-test-coverage` — todos en verde.
- [x] AC4: `check:spec-coverage` en verde tras el conteo actualizado.
- [x] AC5: `npx tsc --noEmit`, `npm run build`, `npm run build --prefix apps/operator-console` sin
      errores. `check:i18n`, `check:ui-primitives`, `check:tuya-policy`, `check:docker-profiles`
      también verificados en verde.
- [x] AC6: `docker build` + `docker run` contra volumen SQLite descartable — arranque correcto
      (`[Bootstrap] Repositorios y servicios inyectados exitosamente.`), `/health` en verde.
      Contenedor, imagen y volumen de prueba eliminados al finalizar.
