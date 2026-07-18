# SearchableSelectField

**Fuente:** `apps/operator-console/src/components/ui/SearchableSelectField.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Selector modular canónico para toda selección general de opciones. El buscador se presenta siempre, por lo que sustituye tanto los menús cortos como los selectores implementados dentro de vistas y widgets.

## Contrato

Recibe `value`, opciones tipadas, callback, placeholder traducido y configuración explícita de búsqueda/posicionamiento. No conoce datos de dominio ni realiza llamadas de red.

## Uso

Usar para dispositivos, escenas, habitaciones, tipos, zonas horarias y tamaños de tarjeta. No crear selectores portal ad hoc ni usar selects nativos para opciones de negocio. Los pickers especializados de iconos y audio permanecen separados porque resuelven catálogos y previsualizaciones propios.

## Estados y aceptación

Soporta valor vacío, valor seleccionado, búsqueda, opción con descripción, lista vacía, disabled, foco visible, Escape y cierre al hacer clic fuera. El menú se mantiene dentro del viewport en móvil, tablet y escritorio.
