# InlineTabCreator

**Fuente:** `apps/operator-console/src/components/InlineTabCreator.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Captura rápidamente el nombre de una pestaña nueva dentro de la navegación de tableros.

## Contrato

Recibe `onConfirm`, `onCancel`, placeholder e `initialValue`. Enfoca el campo al abrir y normaliza el título con `trim` antes de confirmar.

## Uso

Usar únicamente en creación/renombrado de pestañas. La validación de unicidad y persistencia pertenece al dashboard.

## Estados y aceptación

Enter confirma un valor no vacío, Escape cancela y el botón de confirmación no permite títulos vacíos.

