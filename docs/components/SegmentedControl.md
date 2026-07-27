# SegmentedControl

**Fuente:** `apps/operator-console/src/components/ui/SegmentedControl.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Alterna una selección exclusiva entre un conjunto pequeño de opciones relacionadas.

## Contrato

Recibe opciones, valor activo y callback. Las opciones deben ser estables y ya validadas por la vista.

## Uso

Usar para filtros o modos mutuamente excluyentes; usar `Select` si hay muchas opciones o etiquetas largas.

## Estados y aceptación

Activo, inactivo, disabled y foco conservan tamaño coherente. El grupo usa `radiogroup` y cada opción expone `role="radio"` con `aria-checked`; las flechas, Inicio y Fin recorren únicamente las opciones disponibles. Las etiquetas no se truncan: cada opción puede crecer verticalmente o pasar a una nueva fila cuando el ancho disponible no permite mostrar su texto completo.
