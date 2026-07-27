# OverlayAccessibility

**Fuente:** `apps/operator-console/src/components/ui/useOverlayAccessibility.ts`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Centralizar el contrato de accesibilidad de las superficies superpuestas usadas por `Modal` y `Drawer`.

## Contrato

Recibe la visibilidad, el callback de cierre y la referencia del contenedor. Gestiona foco inicial, Escape, ciclo de Tab, restauración de foco y bloqueo del scroll del documento. Mantiene una pila de superficies para que solo la capa superior retenga el foco.

## Estados y aceptación

Al abrir varios overlays, el documento conserva el bloqueo de scroll hasta que se cierre el último. La capa superior retiene foco incluso ante cambios programáticos y no compite con overlays anidados. Al cerrarse cada superficie, el foco vuelve al elemento que la abrió. El comportamiento se mantiene en móvil, tablet y escritorio.
