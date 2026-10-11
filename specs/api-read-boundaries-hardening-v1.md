# SPEC: Endurecimiento de lecturas y firma de cámaras V1

**Estado:** Implementado
**Fecha:** 2026-10-11

## Problema

Una prueba de uso completa y la revisión previa de código mostraron lecturas más abiertas de lo necesario y dos debilidades en el acceso a cámaras:

- Cualquier usuario con sesión podía leer el registro de actividad global, que lista lo que hizo cada usuario.
- El detalle de un dispositivo, su historial y el listado general no comprobaban la pertenencia al hogar, a diferencia del resto de lecturas de dispositivos.
- Las rutas de variables del sistema estaban especificadas pero nunca registradas en el servidor; además, su lectura no exigía rol.
- Sin `CAMERA_PROXY_SIGNING_SECRET`, los tokens de cámara se firmaban con el token de Home Assistant o con una constante publicada en el código.
- La contención de rutas del proxy HLS nativo usaba una comparación de prefijo que acepta directorios hermanos con el mismo comienzo.

## Alcance

- Lecturas de dispositivos con validación de hogar.
- Registro de actividad global y variables del sistema solo para administradores.
- Firma de tokens de cámara sin secretos reutilizados ni públicos.
- Contención de rutas correcta en el proxy HLS.
- Sin cambios en los contratos de respuesta exitosa ni en los comandos de dispositivos.

## Requisitos

- **REQ-01:** `GET /devices/:id` y `GET /devices/:id/activity-logs` validan que el dispositivo pertenece a un hogar del usuario; responden 404 si no existe y 403 si es de otro hogar. Otros fallos conservan `DB_ERROR`.
- **REQ-02:** `GET /devices` devuelve solo dispositivos de los hogares del usuario.
- **REQ-03:** `GET /activity-logs` exige rol administrador y no consulta el repositorio en caso contrario.
- **REQ-04:** `SystemVariableRoutes` está registrada en el servidor y todas sus operaciones, lectura incluida, exigen rol administrador.
- **REQ-05:** Los tokens de cámara se firman con `CAMERA_PROXY_SIGNING_SECRET` si está definido y, si no, con un secreto aleatorio del proceso. No se usa el token de Home Assistant ni constantes del código. Los tokens duran 30 minutos y se reemiten por sesión, de modo que un reinicio solo pide reabrir la cámara.
- **REQ-06:** Un archivo HLS nativo se sirve únicamente si está dentro del directorio de la sesión; un directorio hermano con el mismo prefijo se rechaza.
- **REQ-07:** La consola oculta el registro de auditoría a quien no es administrador.

## Criterios de aceptación

- [x] **AC1:** Un invitado recibe 403 en el registro global, en variables del sistema y en la configuración de Home Assistant, y sigue leyendo dispositivos de su hogar y su actividad.
- [x] **AC2:** Pruebas unitarias cubren pertenencia a hogar en detalle, historial y listado, y el rechazo a no administradores en registro global y variables.
- [x] **AC3:** Un token firmado con la constante antigua es rechazado, y un cambio del token de Home Assistant no invalida los tokens emitidos.
- [x] **AC4:** `isInsideDirectory` acepta el directorio y su contenido, y rechaza hermanos con prefijo común, recorridos `..` y rutas absolutas ajenas.
- [x] **AC5:** Verificado en la instalación real con un administrador y un invitado.

## Evidencia

- `apps/api/routes/device/DeviceReadRoutes.ts`, `SystemVariableRoutes.ts` y `OperatorConsoleServer.ts`.
- `apps/api/routes/camera/cameraProxyToken.ts`, `pathContainment.ts` y `CameraHlsProxyRoutes.ts`.
- Pruebas: `DeviceRoutes.semantic`, `DeviceRoutes.state-sync`, `SystemVariableRoutes`, `CameraRoutes.containment`.
