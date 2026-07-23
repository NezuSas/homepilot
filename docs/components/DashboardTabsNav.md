# DashboardTabsNav

**Fuente:** `apps/operator-console/src/components/DashboardTabsNav.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Presenta y selecciona las pestañas de un tablero, incluida la creación y configuración contextual cuando el usuario tiene permisos.

## Contrato

Recibe pestañas, índice activo y callbacks de selección, creación, edición y menú móvil. La vista conserva persistencia, permisos y datos del tablero.

## Uso

Usar únicamente dentro de la superficie de tableros. Los títulos, etiquetas y accesibilidad se entregan ya traducidos por el consumidor.

## Estados y aceptación

La navegación se desplaza horizontalmente cuando es necesario. Cada pestaña limita visualmente títulos extensos, mantiene el nombre completo como etiqueta y tooltip, y conserva acciones de edición/creación sin provocar overflow de la página.
