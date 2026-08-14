# SPEC: Native Camera PTZ Control V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

Con la negociación de perfiles ONVIF real (Fase 2), el driver ya conoce si una cámara reporta una
`PTZConfiguration` y su token asociado, pero el modelo de capacidades trataba "cámara" como un bloque
plano (`'camera': []` en `capabilities.ts`) sin ningún comando expuesto, y el `vendor` del
dispositivo se usaba de forma ad hoc para guardar el subtipo de protocolo en vez de una etiqueta de
display real.

## Alcance

- Ítem A: `DeviceCommandV1` gana `'ptz_move' | 'ptz_stop'` (en el union type **y** en el array de
  `isValidCommand` — ambos se mantienen a mano en `commands.ts`, es el punto donde es fácil olvidar
  uno de los dos).
- Ítem B: Nueva capacidad `camera_ptz` en `capabilities.ts`: `ptz_move` (parámetros `pan`/`tilt`/
  `zoom`, cada uno normalizado en `[-1, 1]`, mapeo 1:1 con la velocidad `ContinuousMove` de ONVIF) y
  `ptz_stop` (sin parámetros).
- Ítem C: `deviceProfiles.ts` gana una rama explícita para dispositivos
  `integrationSource === 'native-camera' && type === 'camera'`: resuelve `['camera']` o
  `['camera', 'camera_ptz']` según `device.lastKnownState?.ptz === true` — la bandera la escribe
  `NativeCameraService` en cada creación/actualización, reflejando el `ptzSupported` que
  `OnvifPtzCameraDriver` calculó durante la negociación (Fase 2 dejó la columna sin usar;
  esta fase la conecta).
- Ítem D: `NativeCameraDriver` (puerto) gana `supportsPtz(profile)` y los métodos opcionales
  `movePtz`/`stopPtz`. `OnvifPtzCameraDriver` los implementa con nuevas llamadas SOAP
  (`GetConfigurationOptions`, `ContinuousMove`, `Stop`) sobre el servicio PTZ (`Capabilities.PTZ.XAddr`,
  obtenido de `GetCapabilities`). `RtspDvrCameraDriver`/`SonoffRtspCameraDriver.supportsPtz()` siempre
  retorna `false` (no implementan `movePtz`/`stopPtz`, son opcionales en el puerto).
- Ítem E: Detección de PTZ real (no solo "el perfil tiene un `ptzConfigurationToken`"): tras negociar
  un perfil con token PTZ, se llama `GetConfigurationOptions` sobre el servicio PTZ; solo si la
  respuesta confirma `ContinuousPanTiltVelocitySpace` se marca `ptzSupported: true`. Esta detección
  es *best-effort* y nunca bloquea la negociación básica de streaming — cualquier fallo (servicio PTZ
  inalcanzable, respuesta malformada) simplemente deja `ptzSupported: false`.
- Ítem F: Nuevo `NativeCameraDeviceDriver` (implementa el `DeviceDriver` genérico de
  `packages/devices/domain/drivers/DeviceDriver.ts`), registrado en `buildCommandRouter.ts` bajo
  `'native-camera'`. Solo maneja `ptz_move`/`ptz_stop`; resuelve la fuente por `deviceId`, valida
  `ptzSupported`, resuelve el driver de protocolo correspondiente vía `NativeCameraDriverRegistry` y
  delega. Cero endpoints HTTP nuevos — `POST /api/v1/devices/:id/command` ya funciona en cuanto el
  driver está registrado.
- Ítem G: `bootstrap.ts` reordenado: `buildNativeCameraModule` se construye **antes** de
  `buildCommandRouter` (para poder inyectarle el `NativeCameraDriverRegistry` ya compuesto), en vez
  de después del motor de automatización como en la Fase 1. `buildNativeCameraModule` ahora también
  expone `nativeCameraDriverRegistry` en su assembly.
- Ítem H: Frontend — `CameraPtzControl.tsx` (pad direccional de 6 botones: pan arriba/abajo/
  izquierda/derecha, zoom in/out), montado en `CameraViewerModal.tsx` solo cuando
  `device.capabilities` incluye `camera_ptz` (verificado en `CameraDeviceTile.tsx`). Presionar envía
  `ptz_move`; soltar envía `ptz_stop`. Claves i18n nuevas en ambos locales bajo `camera.ptz.*`.

## Fuera de alcance

- No se cachea `ptzXAddr`: cada comando PTZ (`movePtz`/`stopPtz`) vuelve a llamar `GetCapabilities`
  para resolverlo. Es una llamada SOAP extra por comando, aceptada como costo simple frente a la
  complejidad de invalidar una caché si la cámara cambia de IP.
- No se migra `vendor` a una etiqueta de display en esta fase — quedó fuera del alcance decidido;
  `vendor` sigue guardando el `source_type` como en las Fases 1 y 2.
- No se valida contra una cámara ONVIF PTZ real: la negociación, `GetConfigurationOptions` y los
  comandos `ContinuousMove`/`Stop` están cubiertos por fixtures y mocks, no por hardware — ver
  Verificación manual pendiente.

## Requisitos funcionales

- **REQ-01**: `isValidCommand('ptz_move')`/`isValidCommand('ptz_stop')` son verdaderos.
- **REQ-02**: Un dispositivo `native-camera` con `lastKnownState.ptz === true` resuelve las
  capacidades `['camera', 'camera_ptz']`; sin esa bandera, solo `['camera']`.
- **REQ-03**: `CommandCapabilityValidator` acepta `ptz_move`/`ptz_stop` solo si el dispositivo
  resuelve la capacidad `camera_ptz`; rechaza `pan`/`tilt`/`zoom` fuera de `[-1, 1]` o de tipo
  incorrecto.
- **REQ-04**: `NativeCameraDeviceDriver.executeCommand` rechaza cualquier comando que no sea
  `ptz_move`/`ptz_stop`, rechaza `ptz_move` sin ningún eje especificado, y falla limpiamente
  (`success: false`) cuando la fuente no existe o `ptzSupported` es falso — nunca lanza una excepción
  sin capturar.
- **REQ-05**: `OnvifPtzCameraDriver.negotiate` solo marca `ptzSupported: true` cuando el perfil
  elegido reportó un `ptzConfigurationToken` **y** `GetConfigurationOptions` confirmó
  `ContinuousPanTiltVelocitySpace`; cualquier fallo en esa verificación dual deja
  `ptzSupported: false` sin abortar la negociación del stream.

## Requisitos no funcionales

- **NFR-01**: Regresión cero sobre las Fases 1 y 2: los tests existentes de
  `OnvifPtzCameraDriver.test.ts` se actualizan solo para incluir el nuevo campo `ptzSupported` en sus
  aserciones, sin cambiar el comportamiento que ya verificaban.
- **NFR-02**: `check:ui-primitives`/`check:i18n` en verde — el control PTZ usa `IconButton` existente
  y claves de traducción en ambos locales.

## Criterios de aceptación

- [x] AC1: `ptz_move`/`ptz_stop` son comandos válidos.
- [x] AC2: Resolución de capacidades condicionada a `lastKnownState.ptz`.
- [x] AC3: `NativeCameraDeviceDriver` rechaza comandos no-PTZ, PTZ sin ejes, cámara no encontrada y
      cámara sin soporte PTZ — todos con `success: false` y mensaje, nunca una excepción.
- [x] AC4: `OnvifPtzCameraDriver.movePtz`/`stopPtz` resuelven el servicio PTZ y emiten
      `ContinuousMove`/`Stop` con el `profileToken` negociado.
- [x] AC5: La detección de PTZ nunca bloquea el resto de la negociación — un fallo en
      `GetConfigurationOptions` dado un perfil con `ptzConfigurationToken` deja `ptzSupported: false`
      pero el perfil de streaming sigue siendo válido.
- [x] AC6: Suite completa sin regresiones (152 suites, 1276 tests — 1 test de
      `llm_circuit_breaker.test.ts` es intermitente por diseño, con cooldown de 10ms; confirmado no
      relacionado, pasa en aislamiento), typecheck y build (backend + operator-console) limpios.
- [x] AC7: `check:i18n`, `check:ui-primitives`, `check:spec-coverage` (conteo actualizado a 606),
      `check:architecture-boundaries`, `check:no-production-any`, `check:bdd-traceability`,
      `check:module-test-coverage` — todos en verde.
- [x] AC8: Contenedor Docker reconstruido con el `bootstrap.ts` reordenado (native camera module
      antes que command router) arranca correctamente y `/health` en verde.

## Notas técnicas y arquitectura

`packages/devices/domain/{commands,capabilities,deviceProfiles,CapabilityResolver}.ts` — extensiones
aditivas, sin tocar ninguna capacidad existente. `packages/integrations/native-camera/infrastructure/{onvif/{OnvifSoapEnvelopes,OnvifSoapClient},drivers/OnvifPtzCameraDriver,NativeCameraDeviceDriver}.ts`.
`infrastructure/assemblers/{buildNativeCameraModule,buildCommandRouter}.ts`, `bootstrap.ts` (orden de
construcción). Frontend: `apps/operator-console/src/components/{CameraPtzControl,CameraViewerModal,CameraDeviceTile}.tsx`.

## Preguntas abiertas y TODOs

- TODO: verificar contra hardware ONVIF PTZ real cuando esté disponible — negociación de perfiles,
  detección de `ContinuousPanTiltVelocitySpace` y los comandos `ContinuousMove`/`Stop` en sí. Ningún
  test automatizado puede sustituir esta validación.
- TODO: si el costo de re-resolver `ptzXAddr` en cada comando PTZ resulta perceptible en uso real,
  considerar cachear la dirección con invalidación por fallo de comando.
