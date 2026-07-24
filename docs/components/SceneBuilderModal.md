# SceneBuilderModal

**Fuente:** `apps/operator-console/src/views/SceneBuilderModal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Crear o editar escenas mediante nombre, alcance y acciones soportadas por los dispositivos disponibles, usando el contenedor de diálogo compartido de la consola.

## Contrato

Recibe el hogar, estancias, dispositivos y una escena opcional. Mantiene localmente la búsqueda, las acciones seleccionadas y el estado de guardado. Solo permite comandos compatibles con capacidades de luz, interruptor o cortina.

## Uso

La vista de Rutinas lo abre para crear o editar una escena. `Modal` administra portal, foco inicial, Escape, ciclo de Tab, scroll y pie fijo. Durante el guardado se bloquea el cierre y el reenvío.

## Estados y aceptación

El listado conserva búsqueda y selección dentro del viewport. Los errores permanecen localizados en el formulario; guardar permanece disponible en el pie y no desaparece al desplazarse en móvil, tablet o escritorio.
