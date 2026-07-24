# CameraViewerModal

**Fuente:** `apps/operator-console/src/components/CameraViewerModal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Presentar una cámara en una superficie ampliada con estado de stream, control de cierre y una indicación de visualización a pantalla completa.

## Contrato

Recibe las URLs de HLS, stream y snapshot, además del modo preferido. Delega la reproducción a `CameraMediaFrame` y solo mantiene localmente los estados de carga, error y modo activo.

## Uso

Se abre desde tarjetas de cámara y usa `Modal` para portal, foco, Escape, bloqueo de scroll y cierre por fondo. El visor conserva encabezado propio y un pie fijo para no comprometer el área de video.

## Estados y aceptación

Muestra conexión, streaming o error sin reemplazar los controles. El contenido se adapta dentro del viewport en móvil, tablet y escritorio, y el cierre sigue disponible mediante icono, Escape y fondo.
