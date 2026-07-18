# Modal

**Fuente:** `apps/operator-console/src/components/ui/Modal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Contenedor de diálogo dentro del shell de aplicación para formularios, detalles y confirmaciones no destructivas.

## Contrato

`ModalProps` recibe `isOpen`, `onClose`, título, descripción, children, variante y control del cierre. Bloquea el scroll del body mientras está abierto.

## Uso

El contenido debe ser desplazable y sus acciones deben quedar visibles. Usar `ConfirmModal` para confirmación crítica.

## Estados y aceptación

Respeta variantes default/danger/warning/success, backdrop, escape mediante consumidor cuando aplique y viewport móvil/tablet/escritorio.

