# SelectableOptionCard

**Fuente:** `apps/operator-console/src/components/ui/SelectableOptionCard.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Representa una opción exclusiva con título, descripción opcional y estado seleccionado. Se usa dentro de un contenedor con `role="radiogroup"` cuando las opciones requieren más contexto que un selector compacto.

## Contrato

Recibe `title`, `description`, `checked` y las props convencionales de botón. Emite `onClick`; el consumidor conserva el estado seleccionado y el `radiogroup` que agrupa las opciones.

## Estados y aceptación

Mantiene semántica `radio`, foco visible, indicador de selección, ajuste seguro de textos extensos y área táctil adecuada desde móvil hasta escritorio.
