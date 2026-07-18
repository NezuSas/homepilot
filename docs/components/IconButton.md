# IconButton

**Fuente:** `apps/operator-console/src/components/ui/IconButton.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Acción compacta representada por icono: cerrar, editar, recargar o abrir una acción contextual.

## Contrato

Recibe el icono, `label` accesible, variante y atributos nativos de botón. `label` es obligatorio para lectores de pantalla y tooltip.

## Uso

No sustituye un botón con texto cuando el significado no es universal. El consumidor traduce el label y controla disabled/loading.

## Estados y aceptación

Debe mostrar foco visible, no encogerse en touch y respetar normal, hover, focus y disabled.

