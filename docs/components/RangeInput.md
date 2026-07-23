# RangeInput

**Fuente:** `apps/operator-console/src/components/ui/RangeInput.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Control modular para valores numéricos continuos o discretos: posición de cortinas, opacidad y recorte de imagen.

## Contrato

Recibe `value`, `min`, `max`, `step`, `onValueChange` y opcionalmente `onValueCommit`. El cambio se comunica de forma continua; la confirmación se emite al terminar interacción por mouse, touch, foco o teclado. `formatValue` y `showBounds` permiten presentar límites y valor actual sin duplicar la estructura visual.

## Uso

Usar para rangos nativos especializados. El consumidor conserva las reglas de dominio, traduce `aria-label` y decide si el valor requiere confirmación diferida.

## Estados y aceptación

Mantiene foco visible, estado deshabilitado y área táctil consistente. No ejecuta lógica de negocio ni crea estado global.
