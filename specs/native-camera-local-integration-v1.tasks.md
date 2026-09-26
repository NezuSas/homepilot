# Tareas: Native Camera Local Integration V1

## Implementado

- [x] Integración de cámaras nativas cubierta por rutas y pruebas de cámara.

## Verificación pendiente

- [x] Validar contratos de listado y alta RTSP/DVR, autenticación, `homeId` obligatorio, persistencia del dispositivo pendiente y enmascaramiento de contraseña. Evidencia: `apps/api/__tests__/NativeCameraRoutes.test.ts`.
- [x] Carga de cámaras tras snapshot de topología (AC12). `NativeCamerasView` refresca el snapshot al montar y consulta cámaras cuando existe el hogar activo.
- [x] Streaming continuo en el visor de cámaras nativas (AC13). La miniatura usa snapshots sin arrancar HLS; `includeHls=true` inicia la sesión HLS firmada del visor.
- [x] Sesiones concurrentes y apagado por inactividad (AC14). Las solicitudes HLS renuevan la actividad; el reaper detiene FFmpeg cuando ninguna sesión de la cámara sigue activa. El plazo predeterminado es 90 s y puede ajustarse con `HOMEPILOT_NATIVE_HLS_IDLE_MS` (mínimo 15 s). Pruebas: `CameraRoutes.test.ts` y `FfmpegMediaTranscoder.test.ts`.
- [x] El visor renueva su sesión antes de los 30 minutos de validez del token, sin convertir las miniaturas en consumidores HLS.
- [x] VAAPI opt-in y respaldo por software (AC15). La combinación de `docker-compose.office.yml` y `docker-compose.camera-vaapi.yml` expone `/dev/dri` y activa `HOMEPILOT_CAMERA_HLS_ENCODER=auto`. Si VAAPI no inicia, el visor vuelve a `libx264`.
- [ ] Validar descubrimiento, persistencia de alta/edición/baja y streaming local para cada cambio funcional.
- [ ] Medir en la mini-PC CPU, número de procesos, estabilidad prolongada de VAAPI y reproducción de varias cámaras antes de activar el overlay o desplegar esta optimización.
