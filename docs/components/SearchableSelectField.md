# SearchableSelectField

**Fuente:** `apps/operator-console/src/components/ui/SearchableSelectField.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Selector modular para listas extensas, opciones con descripción o contextos que requieren búsqueda. Sustituye menús de selección implementados dentro de vistas y widgets.

## Contrato

Recibe `value`, opciones tipadas, callback, placeholder traducido y configuración explícita de búsqueda/posicionamiento. No conoce datos de dominio ni realiza llamadas de red.

## Uso

Usar para listas largas de dispositivos, escenas, habitaciones, tipos o tamaños de tarjeta. Usar `SelectField` para listas nativas cortas sin búsqueda. No crear selectores portal ad hoc en una vista.

## Estados y aceptación

Soporta valor vacío, valor seleccionado, búsqueda, opción con descripción, lista vacía, disabled, foco visible, Escape y cierre al hacer clic fuera. El menú se mantiene dentro del viewport en móvil, tablet y escritorio.
