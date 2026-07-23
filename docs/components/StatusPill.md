# StatusPill

**Fuente:** `apps/operator-console/src/components/ui/StatusPill.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Representa un estado corto y no interactivo: activo, apagado, disponible, error o pendiente.

## Contrato

Recibe etiqueta y variante semántica; no traduce ni infiere estado del dispositivo.

## Uso

Usar junto al título o detalle, nunca como único indicador de una acción crítica.

## Estados y aceptación

Texto corto, contraste suficiente, sin desbordar tarjetas compactas y con color no exclusivo para comunicar estado. Las etiquetas largas se ajustan dentro del ancho disponible sin expandir su contenedor ni interferir con iconos o acciones cercanas.
