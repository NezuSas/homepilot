# Tareas: Native Camera PTZ Control V1

## Implementación

- [x] AC1: `commands.ts` — `'ptz_move' | 'ptz_stop'` en `DeviceCommandV1` y en el array de
      `isValidCommand`.
- [x] AC2: `capabilities.ts` — capacidad `camera_ptz` (`ptz_move` con `pan`/`tilt`/`zoom` en
      `[-1,1]`, `ptz_stop`); `deviceProfiles.ts` — rama `native-camera`+`camera` condicionada a
      `lastKnownState.ptz`; `CapabilityResolver.ts` — `camera_ptz` agregado a `isValidCapabilityType`.
- [x] AC4/AC5: `OnvifSoapEnvelopes.ts` — `buildGetPtzConfigurationOptionsEnvelope`,
      `buildContinuousMoveEnvelope`, `buildPtzStopEnvelope`. `OnvifSoapClient.ts` —
      `getCapabilities` (ahora también resuelve `ptzXAddr`, `getMediaServiceUrl` delega en él sin
      cambiar su contrato), `getPtzConfigurationOptions`, `continuousMove`, `stopPtz`.
      `OnvifPtzCameraDriver.ts` — `supportsPtz`, `movePtz`, `stopPtz`, detección best-effort de PTZ
      tras negociar un perfil con `ptzConfigurationToken`.
- [x] `RtspDvrCameraDriver`/`SonoffRtspCameraDriver` — `supportsPtz()` siempre `false`.
      `TcpOnlyNegotiation.ts` — `ptzSupported: false` en el perfil devuelto.
- [x] AC3: Nuevo `NativeCameraDeviceDriver.ts` (implementa `DeviceDriver`), registrado en
      `buildCommandRouter.ts` bajo `'native-camera'`.
- [x] `NativeCameraService.create`/`update` — persisten `ptzSupported` en `NativeCameraSource` y
      escriben `lastKnownState.ptz` en el dispositivo asociado.
- [x] `bootstrap.ts` — `buildNativeCameraModule` reordenado antes de `buildCommandRouter`;
      `buildNativeCameraModule` expone `nativeCameraDriverRegistry`; `buildCommandRouter` recibe
      `nativeCameraSourceRepository`/`nativeCameraDriverRegistry` como deps nuevas.
- [x] Frontend: `CameraPtzControl.tsx` (nuevo), montado condicionalmente en
      `CameraViewerModal.tsx`/`CameraDeviceTile.tsx` según la capacidad `camera_ptz`; claves i18n
      `camera.ptz.*` en `es`/`en`.

## Verificación

- [x] AC1-AC5: `OnvifSoapClient.test.ts` sin cambios de comportamiento previo (Fase 2 intacta);
      `OnvifPtzCameraDriver.test.ts` extendido con 8 tests nuevos (detección de PTZ exitosa/sin
      dirección de servicio/sin token de configuración, `supportsPtz`, `movePtz`/`stopPtz` exitosos,
      `movePtz` sin `profileToken`, `movePtz` sin dirección PTZ) + actualización de 3 aserciones
      preexistentes con el nuevo campo `ptzSupported`.
- [x] AC3: `NativeCameraDeviceDriver.test.ts` (nuevo, 9 tests: soporte por `integrationSource`,
      rechazo de comando no-PTZ, fuente no encontrada, cámara sin PTZ, `ptz_move` sin ejes,
      despacho correcto de `ptz_move`/`ptz_stop`, driver sin `movePtz`, propagación de error).
- [x] AC6: `npx tsc --noEmit`, `npm run build`, `npm run build --prefix apps/operator-console`,
      suite completa (152 suites, 1276 tests) sin regresiones no intencionales (1 test de
      `llm_circuit_breaker.test.ts` intermitente por cooldown de 10ms, confirmado preexistente y no
      relacionado — pasa en aislamiento).
- [x] AC7: `check:spec-coverage` (conteo actualizado a 607), `check:architecture-boundaries`,
      `check:no-production-any`, `check:bdd-traceability`, `check:module-test-coverage`,
      `check:i18n`, `check:ui-primitives` — todos en verde.
- [x] AC8: `docker build` + `docker run` con el `bootstrap.ts` reordenado — arranque correcto,
      `/health` en verde. Contenedor, imagen y volumen de prueba eliminados al finalizar.
