# SPEC: Native Camera Integration Hexagonal Refactor V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

El usuario pidió mejorar la integración nativa de cámaras "para todos los protocolos que tenemos
ahora" (ONVIF/PTZ, RTSP/DVR, Sonoff-RTSP) como base para soportar después cámaras Matter. Auditando
el código se confirmó que, a diferencia de las demás integraciones locales (Sonoff, Home Assistant),
que siguen el patrón `packages/integrations/<nombre>/{application,infrastructure}`, la integración
nativa de cámaras vivía suelta dentro de `apps/api/`:

- `apps/api/OnvifDiscovery.ts`: descubrimiento WS-Discovery por UDP multicast, parseo SOAP por regex.
- `apps/api/routes/NativeCameraRoutes.ts`: CRUD + lógica de negociación ONVIF/TCP duplicada entre
  create y update, validación, detección de duplicados — todo mezclado con el manejo HTTP.
- `apps/api/routes/CameraRoutes.ts`: además del proxy HLS/snapshot compartido con Home Assistant,
  contenía toda la mecánica de `ffmpeg` (spawn de procesos, runtime HLS, construcción de URL RTSP)
  específica de cámaras nativas.

Esto hacía imposible añadir un cuarto protocolo (Matter) sin seguir acoplando más lógica a las rutas
HTTP, y dificultaba testear cada protocolo de forma aislada.

## Alcance

Extracción pura a `packages/integrations/native-camera/`, **sin cambio de comportamiento
observable**: mismos endpoints, mismo esquema de `native_camera_sources`, mismo contrato de sesión
de cámara consumido por `CameraMediaFrame.tsx` (`{snapshotPath, streamPath, hlsPath?}`).

- Ítem A: puerto `NativeCameraDriver` (`application/ports/`) con un driver por protocolo en
  `infrastructure/drivers/`: `OnvifPtzCameraDriver` (delega en `node-onvif`, sin cambios de
  comportamiento — Phase 2 lo reemplaza), `RtspDvrCameraDriver` y `SonoffRtspCameraDriver`
  (comparten `negotiateTcpOnly`, una función, no una clase base, ya que cada cuerpo es una línea).
- Ítem B: `NativeCameraService` (casos de uso: `create`/`update`/`delete`/`listByHome`/`discover`),
  extraído de `NativeCameraRoutes.ts` con cero cambio de lógica — solo se reemplazó el
  `require('node-onvif')`/TCP-check inline por una llamada a `driver.negotiate()`.
- Ítem C: `NativeCameraStreamingService` + `FfmpegMediaTranscoder` (puerto `MediaTranscoderPort`),
  extraídos de `CameraRoutes.ts` con cero cambio de lógica — los mismos argumentos de `ffmpeg`, el
  mismo directorio temporal, el mismo mecanismo de espera de `index.m3u8`.
- Ítem D: `OnvifWsDiscoveryProbe`, movido verbatim desde `apps/api/OnvifDiscovery.ts` (parseo regex
  sin cambios — Phase 2 lo reemplaza por `fast-xml-parser`).
- Ítem E: nuevo assembler `infrastructure/assemblers/buildNativeCameraModule.ts` (patrón
  `buildHomeAssistantModule.ts`), invocado desde `bootstrap.ts`, expuesto como
  `container.services.nativeCameraService`/`nativeCameraStreamingService`.
- Ítem F: `NativeCameraRoutes.ts` y `CameraRoutes.ts` quedan como adaptadores HTTP delgados: matching
  de URL, guard de auth, parsing de body, mapeo de errores de dominio a status HTTP. La rama de
  Home Assistant en `CameraRoutes.ts` (proxy HLS/snapshot/MJPEG de `camera.*`) no se toca.

## Fuera de alcance

- No se reemplaza el parseo regex de SOAP/ONVIF ni la dependencia `node-onvif` (Phase 2:
  `specs/native-camera-onvif-profile-negotiation-v1.md`).
- No se agrega negociación de perfiles múltiples ni PTZ (Phase 3).
- No se agrega reconocimiento de cámaras Matter (Phase 4).
- No se mueve `NativeCameraSourceRepository`/`SQLiteNativeCameraSourceRepository`: la tabla
  `native_camera_sources` está en cascada FK con `devices` y el repositorio ya sigue el patrón
  estándar de puerto+adaptador en `packages/devices/`; moverlo no aporta nada, el paquete nuevo lo
  importa igual que Sonoff importa `DeviceRepository`.
- No se toca el modelo de datos (`native_camera_sources`), ni el `deviceId`/`externalId` generados,
  ni la clave de duplicado `(homeId, host, rtspPort, rtspPath)`.

## Requisitos funcionales

- **REQ-01**: Los 5 endpoints existentes (`GET /native-cameras/discover`, `GET /native-cameras`,
  `POST /native-cameras`, `PUT /native-cameras/:deviceId`, `DELETE /native-cameras/:deviceId`, y los
  3 endpoints de `CameraRoutes` — `session`, `snapshot|stream`, `hls/*`) devuelven exactamente las
  mismas respuestas (status, forma del payload) que antes de la extracción.
- **REQ-02**: `OnvifPtzCameraDriver.negotiate` produce el mismo resultado que la lógica inline
  anterior: éxito ONVIF → `{outcome:'negotiated', profile}`; error de credenciales →
  `{outcome:'unauthorized'}`; cualquier otro fallo ONVIF → fallback a TCP; TCP alcanzable →
  `{outcome:'reachable', profile}`; TCP inalcanzable → `{outcome:'unreachable', detail}`.
- **REQ-03**: `RtspDvrCameraDriver`/`SonoffRtspCameraDriver` nunca invocan lógica ONVIF — solo
  verifican alcanzabilidad TCP sobre el `rtspPath` provisto por el operador.
- **REQ-04**: Un dispositivo `PENDING`/`camera`/`native-camera` se crea con exactamente los mismos
  campos que antes (`vendor` sigue guardando el `sourceType` en esta fase).

## Requisitos no funcionales

- **NFR-01**: Regresión cero: `apps/api/__tests__/NativeCameraRoutes.test.ts` y
  `apps/api/__tests__/CameraRoutes.test.ts` pasan con las mismas aserciones que antes de la
  extracción — solo cambió cómo se inyectan sus dependencias (el reemplazo del monkey-patch de
  `checkTcpReachable` por un `NetworkProbePort` inyectado es el único ajuste de wiring necesario).
- **NFR-02**: `application/` bajo `packages/integrations/native-camera/` no importa nada de
  `infrastructure/` (regla ya verificada por `check:architecture-boundaries`).

## Criterios de aceptación

- [x] AC1: Los 8 tests preexistentes de `NativeCameraRoutes.test.ts` y `CameraRoutes.test.ts` pasan
      sin modificar sus aserciones.
- [x] AC2: Suite completa sin regresiones (148 suites, 1234 tests tras sumar la cobertura nueva).
- [x] AC3: `check:architecture-boundaries`, `check:no-production-any`, `check:bdd-traceability`,
      `check:module-test-coverage` en verde.
- [x] AC4: `check:spec-coverage` actualizado (regla ampliada + conteo 583→596) y en verde.
- [x] AC5: `npx tsc --noEmit`, `npm run build`, `npm run build --prefix apps/operator-console` sin
      errores.
- [x] AC6: Contenedor Docker reconstruido, arranque correcto y `/health` en verde con el nuevo
      assembler `buildNativeCameraModule` activo.

## Notas técnicas y arquitectura

Estructura final: `packages/integrations/native-camera/{application/{ports/},infrastructure/{drivers/,onvif/},__tests__/}`.
Ver `specs/native-camera-local-integration-v1.md` (sección Arquitectura, actualizada) para el mapa
completo. `infrastructure/assemblers/buildNativeCameraModule.ts` compone los tres drivers con un
único `TcpNetworkProbe` compartido y un `FfmpegMediaTranscoder`.

## Preguntas abiertas y TODOs

- TODO (Phase 2): reemplazar `node-onvif`/regex SOAP por `fast-xml-parser` + `OnvifSoapClient` con
  negociación real de perfiles (`GetProfiles`/`GetStreamUri`).
- TODO (Phase 3): capacidad `camera_ptz` y comandos `ptz_move`/`ptz_stop`.
- TODO (Phase 4): reconocimiento de cámaras Matter vía la plataforma de Home Assistant, sin SDK
  Matter propio ni cambios en este paquete.
