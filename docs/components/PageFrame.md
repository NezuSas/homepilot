# PageFrame

**Fuente:** `apps/operator-console/src/components/ui/PageFrame.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Marco responsive de una vista de consola: ancho, espaciado y jerarquía de página.

## Contrato

Recibe children y opciones de densidad o clase; no decide navegación, permisos ni fetch.

## Uso

Usar como raíz de vistas de sidebar para evitar márgenes y breakpoints paralelos.

## Estados y aceptación

El contenido mantiene scroll vertical, padding adaptativo y ningún overflow horizontal intencional.

