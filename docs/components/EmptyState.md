# EmptyState

**Fuente:** `apps/operator-console/src/components/ui/EmptyState.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Explica por qué una colección o superficie no contiene datos y ofrece una acción cuando corresponde.

## Contrato

Recibe icono, título, descripción y acción opcional. No decide si una colección está vacía.

## Uso

Usar después de que terminó la carga inicial; no sustituir datos previos durante refresh.

## Estados y aceptación

El mensaje es traducible, no bloquea scroll y la acción conserva foco visible. En móvil reduce el espacio vertical, ajusta títulos y descripciones largas sin desborde y ofrece la acción con el ancho disponible; desde tablet conserva su tamaño natural y centrado.
