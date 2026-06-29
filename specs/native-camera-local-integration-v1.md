# Spec: Native Camera Local Integration V1

## Contexto
HomePilot necesita actuar como un bridge local de cámaras, permitiendo configurar cámaras IP nativamente sin depender de Home Assistant. HomePilot guardará las credenciales localmente y se encargará de hacer el proxy del video RTSP a un stream HLS compatible con el navegador.

La integración nativa soporta perfiles explícitos:
- `onvif-ptz`: cámara ONVIF, preparada para cámaras PTZ y negociación del perfil RTSP por ONVIF.
- `rtsp-dvr`: cámara o canal proveniente de DVR/NVR por RTSP directo.
- `sonoff-rtsp`: cámara Sonoff compatible con stream RTSP local.

## Arquitectura
- **Backend (Storage):** Las credenciales y parámetros de conexión (tipo de fuente, host, puerto RTSP, puerto ONVIF, credenciales) se guardan en una nueva tabla `native_camera_sources`.
- **Backend (API):** Nuevas rutas CRUD en `NativeCameraRoutes.ts` permiten gestionar estas fuentes.
- **Backend (Streaming):** `CameraRoutes.ts` detecta si la cámara es de tipo `native-camera` (vía `integration_source`). Si es así, spawnea un proceso `ffmpeg` para capturar RTSP y generar segmentos HLS en un directorio temporal.
- **Frontend (UI):** Una nueva vista `NativeCamerasView` en el panel de Sistema permite a los administradores agregar, editar y eliminar cámaras nativas.

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

Al crear una fuente, el sistema crea automáticamente un dispositivo en la tabla `devices` con tipo `camera`, estado `active` y `integration_source` de `native-camera`.

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
