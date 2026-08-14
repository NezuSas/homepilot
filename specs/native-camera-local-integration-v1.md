# Spec: Native Camera Local Integration V1

**Estado:** Implementado

## Contexto
HomePilot necesita actuar como un bridge local de cámaras, permitiendo configurar cámaras IP nativamente sin depender de Home Assistant. HomePilot guardará las credenciales localmente y se encargará de hacer el proxy del video RTSP a un stream HLS compatible con el navegador.

La integración nativa soporta perfiles explícitos:
- `onvif-ptz`: cámara ONVIF, preparada para cámaras PTZ y negociación del perfil RTSP por ONVIF.
- `rtsp-dvr`: cámara o canal proveniente de DVR/NVR por RTSP directo.
- `sonoff-rtsp`: cámara Sonoff compatible con stream RTSP local.

RTSP puro no define un mecanismo universal de descubrimiento. Si el DVR o cámara aparece por ONVIF/WS-Discovery, HomePilot puede reutilizar ese resultado únicamente como ayuda para prellenar `host` y `name`, pero debe guardar la fuente con el perfil elegido (`rtsp-dvr` o `sonoff-rtsp`) y con puerto RTSP recomendado `554`.

Para `onvif-ptz`, la ruta RTSP no se solicita como dato principal porque HomePilot negocia el perfil de video por ONVIF. Para `rtsp-dvr` y `sonoff-rtsp`, la ruta RTSP es obligatoria porque cada fabricante/modelo puede exponer canales con rutas distintas.

## Arquitectura
- **Backend (Storage):** Las credenciales y parámetros de conexión (tipo de fuente, host, puerto RTSP, puerto ONVIF, credenciales) se guardan en la tabla `native_camera_sources` (puerto
  `NativeCameraSourceRepository`, `packages/devices/domain/repositories/`; implementación
  `SQLiteNativeCameraSourceRepository`, sin cambios respecto al modelo de datos original).
- **Backend (lógica de protocolo):** desde la refactorización de
  [[native-camera-integration-hexagonal-refactor-v1]], toda la lógica específica de protocolo vive en
  `packages/integrations/native-camera/` siguiendo el mismo patrón hexagonal que
  `packages/integrations/sonoff` y `packages/integrations/home-assistant`: un driver por protocolo
  (`OnvifPtzCameraDriver`, `RtspDvrCameraDriver`, `SonoffRtspCameraDriver`) tras el puerto
  `NativeCameraDriver`, orquestados por `NativeCameraService` (CRUD + descubrimiento) y
  `NativeCameraStreamingService` (sesión de streaming).
- **Backend (API):** `NativeCameraRoutes.ts` y `CameraRoutes.ts` son adaptadores HTTP delgados —
  matching de URL, guard de autenticación, parsing de body, mapeo de errores a status HTTP — que
  delegan toda la lógica de negocio a los servicios anteriores.
- **Backend (Streaming):** `FfmpegMediaTranscoder` (infraestructura del paquete) spawnea `ffmpeg`
  para capturar RTSP y generar segmentos HLS/snapshot/MJPEG en un directorio temporal, detrás del
  puerto `MediaTranscoderPort`.
- **Frontend (UI):** Una vista `NativeCamerasView` en el panel de Sistema permite a los
  administradores agregar, editar y eliminar cámaras nativas (sin cambios en esta iteración).

## Modelo de Datos

Tabla: `native_camera_sources`
- `device_id` (PK, FK a `devices(id)` ON DELETE CASCADE)
- `home_id` (FK a `homes(id)`)
- `source_type` (`onvif-ptz`, `rtsp-dvr`, `sonoff-rtsp`)
- `name` (string)
- `host` (string)
- `onvif_port` (integer)
- `rtsp_port` (integer)
- `username` (string)
- `password` (string)
- `rtsp_path` (string)
- `enabled` (integer, boolean flag)

Al crear una fuente, el sistema crea automáticamente un dispositivo en la tabla `devices` con tipo `camera`, estado `PENDING` hasta su asignación y `integration_source` de `native-camera`.

No se permite registrar dos cámaras nativas con el mismo `home_id`, `host`, `rtsp_port` y `rtsp_path`. Si el endpoint ya existe, el API debe responder `409 NATIVE_CAMERA_ALREADY_EXISTS`.

## Seguridad
- Las contraseñas de las cámaras se almacenan en el backend y **nunca se envían al frontend** en las respuestas del API (se envían enmascaradas o vacías).
- El stream HLS se sirve usando URLs con tokens cortos firmados criptográficamente, previniendo acceso directo no autenticado a los streams HLS.

## Restricciones y Acceptance Criteria
1. El usuario debe poder registrar una cámara nativa proveyendo IP, puertos, y credenciales.
2. Al registrarse, la cámara debe aparecer en el sistema como un dispositivo con tipo `camera`.
3. Al visualizar la cámara en la UI (ej. desde Dashboard o Inbox), el backend debe spawnear ffmpeg y servir video (siempre y cuando ffmpeg esté disponible y la cámara sea accesible).
4. Al eliminar la cámara nativa, su registro en `devices` debe eliminarse, al igual que su fuente.
5. `ffmpeg` debe estar presente en la imagen Docker del backend.
6. El usuario debe poder seleccionar el perfil de cámara nativa antes de guardar: ONVIF/PTZ, RTSP/DVR o Sonoff/RTSP.
7. Para `onvif-ptz`, HomePilot debe intentar negociar el stream por ONVIF antes de caer a validación TCP RTSP.
8. Para `rtsp-dvr` y `sonoff-rtsp`, HomePilot debe evitar la negociación ONVIF y validar el endpoint RTSP configurado.
9. Si la cámara ya existe, el backend debe bloquear el duplicado y el frontend debe mostrar un aviso visual consistente con el design system.
10. En el alta de cámaras, el usuario debe poder seleccionar ONVIF/PTZ, RTSP/DVR o Sonoff/RTSP antes del formulario de conexión. Los resultados descubiertos por ONVIF pueden mostrarse también en RTSP/DVR y Sonoff/RTSP solo como ayuda para prellenar datos.
11. Para `rtsp-dvr` y `sonoff-rtsp`, el formulario y el backend deben exigir una ruta RTSP explícita; para `onvif-ptz`, el formulario debe priorizar el puerto ONVIF y ocultar la ruta RTSP manual.
12. Al abrir la sección de cámaras nativas, la consola debe refrescar el snapshot de topología y solicitar `GET /api/v1/native-cameras` solo después de resolver el `homeId` activo, incluso si el usuario entra directamente a la sección.
