# Spec: Native Camera Local Integration V1

## Contexto
HomePilot necesita actuar como un bridge local de cámaras, permitiendo configurar cámaras IP nativamente (ONVIF/RTSP) sin depender de Home Assistant. HomePilot guardará las credenciales localmente y se encargará de hacer el proxy del video RTSP a un stream HLS compatible con el navegador.

## Arquitectura
- **Backend (Storage):** Las credenciales y parámetros de conexión (host, puerto RTSP, puerto ONVIF, credenciales) se guardan en una nueva tabla `native_camera_sources`.
- **Backend (API):** Nuevas rutas CRUD en `NativeCameraRoutes.ts` permiten gestionar estas fuentes.
- **Backend (Streaming):** `CameraRoutes.ts` detecta si la cámara es de tipo `native-camera` (vía `integration_source`). Si es así, spawnea un proceso `ffmpeg` para capturar RTSP y generar segmentos HLS en un directorio temporal.
- **Frontend (UI):** Una nueva vista `NativeCamerasView` en el panel de Sistema permite a los administradores agregar, editar y eliminar cámaras nativas.

## Modelo de Datos

Tabla: `native_camera_sources`
- `device_id` (PK, FK a `devices(id)` ON DELETE CASCADE)
- `home_id` (FK a `homes(id)`)
- `name` (string)
- `host` (string)
- `onvif_port` (integer)
- `rtsp_port` (integer)
- `username` (string)
- `password` (string)
- `rtsp_path` (string)
- `enabled` (integer, boolean flag)

Al crear una fuente, el sistema crea automáticamente un dispositivo en la tabla `devices` con tipo `camera`, estado `active` y `integration_source` de `native-camera`.

## Seguridad
- Las contraseñas de las cámaras se almacenan en el backend y **nunca se envían al frontend** en las respuestas del API (se envían enmascaradas o vacías).
- El stream HLS se sirve usando URLs con tokens cortos firmados criptográficamente, previniendo acceso directo no autenticado a los streams HLS.

## Restricciones y Acceptance Criteria
1. El usuario debe poder registrar una cámara nativa proveyendo IP, puertos, y credenciales.
2. Al registrarse, la cámara debe aparecer en el sistema como un dispositivo con tipo `camera`.
3. Al visualizar la cámara en la UI (ej. desde Dashboard o Inbox), el backend debe spawnear ffmpeg y servir video (siempre y cuando ffmpeg esté disponible y la cámara sea accesible).
4. Al eliminar la cámara nativa, su registro en `devices` debe eliminarse, al igual que su fuente.
5. `ffmpeg` debe estar presente en la imagen Docker del backend.
