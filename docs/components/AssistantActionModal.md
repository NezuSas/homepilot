# AssistantActionModal

**Fuente:** `apps/operator-console/src/components/AssistantActionModal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Ejecutar una acción concreta sugerida por el asistente, sin duplicar la infraestructura visual o accesible de los diálogos de la consola.

## Contrato

Recibe el identificador del hallazgo, la acción tipada, nombre de dispositivo opcional y callbacks de cierre y éxito. Usa `Modal` para portal, foco, Escape, ciclo de Tab, scroll y composición responsive. Sus formularios conservan los flujos de asignar estancia, renombrar dispositivo, importar dispositivo y activar un borrador.

## Uso

Solo debe abrirse desde una sugerencia del asistente que ya entregue una acción válida. El consumidor refresca sus datos mediante `onSuccess`; este componente no conoce ni modifica stores globales.

## Estados y aceptación

La confirmación se bloquea mientras se envía, evitando cierres o doble ejecución. Las acciones se mantienen visibles en el pie fijo del modal y el contenido largo conserva desplazamiento interno en móvil, tablet y escritorio.
