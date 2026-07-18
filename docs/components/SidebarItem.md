# SidebarItem

**Fuente:** `apps/operator-console/src/components/ui/SidebarItem.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Elemento de navegación principal o secundario del sidebar.

## Contrato

Recibe etiqueta, icono, estado activo, contador y callback/navegación. El shell calcula visibilidad según permisos.

## Uso

Usar para cada opción del sidebar y sus subopciones; no definir tamaños de texto independientes en consumidores.

## Estados y aceptación

Normal, activo, expandido, colapsado y foco deben conservar etiqueta visible o accesible en todos los breakpoints.

