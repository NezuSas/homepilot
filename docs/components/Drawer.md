# Drawer

**Fuente:** `apps/operator-console/src/components/ui/Drawer.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Presentar detalles y formularios laterales sin duplicar portal, capa de fondo, foco, teclado o bloqueo del desplazamiento global.

## Contrato

`DrawerProps` recibe `isOpen`, contenido y cierre opcional. Puede asociar título o descripción para accesibilidad y permite ajustar la capa, panel y fondo sin modificar su comportamiento. `hideCloseButton` permite que un flujo use su propia cabecera sin duplicar acciones visibles.

## Uso

Se usa para superficies laterales persistentes, como el inspector de dispositivos. El contenido debe usar una columna flexible con scroll interno cuando supere la altura del viewport.

## Estados y aceptación

Bloquea el scroll del documento mientras está abierto, restaura el foco al cerrar, cierra con Escape, contiene la navegación Tab y conserva el panel dentro del viewport en móvil, tablet y escritorio.
