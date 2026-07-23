# DeviceTileShell

**Fuente:** `apps/operator-console/src/components/ui/DeviceTileShell.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Shell estructural para tarjetas de dispositivo con densidad y layout consistentes.

## Contrato

Recibe contenido de cabecera, cuerpo y acciones como slots; no deriva estado de integración ni ejecuta comandos.

## Uso

Usar cuando una tarjeta requiere composición distinta pero debe conservar el sistema visual de dispositivo.

## Estados y aceptación

El contenido no se superpone, respeta altura mínima tokenizada y se adapta de una a varias columnas. Puede reducirse dentro de grids o paneles angostos, conserva interacción táctil cuando aplica y comunica el estado deshabilitado mediante `aria-disabled`.
