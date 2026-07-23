# ToggleSwitch

**Fuente:** `apps/operator-console/src/components/ui/ToggleSwitch.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Control booleano accesible para preferencias y configuración. Representa estados activado/desactivado sin exponer contratos de dominio.

## Contrato

Recibe `checked`, `onCheckedChange` y un `label` obligatorio para accesibilidad. Admite tamaños `sm` y `md`, y atributos nativos de botón compatibles.

## Uso

La vista consumidora aporta la etiqueta visible, su traducción y la persistencia del cambio. No se usa para ejecutar acciones de un solo disparo: para ello se usa `Button` o `IconButton`.

## Estados y aceptación

Expone `role="switch"`, `aria-checked` y `data-state` con `checked` o `unchecked`. Conserva dimensiones táctiles fijas, foco visible y `touch-manipulation`, por lo que no debe encogerse ni provocar desborde en filas responsivas.
