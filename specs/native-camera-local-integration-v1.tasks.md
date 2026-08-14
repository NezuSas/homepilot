# Tareas: Native Camera Local Integration V1

## Implementado

- [x] Integración de cámaras nativas cubierta por rutas y pruebas de cámara.

## Verificación pendiente

- [x] Validar contratos de listado y alta RTSP/DVR, autenticación, `homeId` obligatorio, persistencia del dispositivo pendiente y enmascaramiento de contraseña. Evidencia: `apps/api/__tests__/NativeCameraRoutes.test.ts`.
- [x] Carga de cámaras tras snapshot de topología (AC12). `NativeCamerasView` refresca el snapshot al montar y consulta cámaras cuando existe el hogar activo.
- [x] Streaming continuo de cámaras nativas (AC13). Las sesiones nativas crean y exponen HLS firmado por defecto, sin depender de un parámetro opcional del consumidor.
- [ ] Validar descubrimiento, persistencia de alta/edición/baja y streaming local para cada cambio funcional.
