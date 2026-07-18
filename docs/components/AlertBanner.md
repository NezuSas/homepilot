# AlertBanner

**Fuente:** `apps/operator-console/src/components/ui/AlertBanner.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Comunica información, éxito, advertencia o error sin reemplazar el contenido existente.

## Contrato

Recibe variante, mensaje y contenido opcional de acción. El consumidor decide cuándo mostrarlo y traduce sus textos.

## Uso

Usar para estados relevantes de página o formulario. No usar como toast efímero ni para errores silenciosos de consola.

## Estados y aceptación

Cada variante conserva icono, contraste y etiqueta semántica legible en ambos temas.

