# Modal

**Fuente:** `apps/operator-console/src/components/ui/Modal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Contenedor de diálogo dentro del shell de aplicación para formularios, detalles y confirmaciones no destructivas.

## Contrato

`ModalProps` recibe `isOpen`, `onClose`, título, descripción, children, variante y control del cierre. `headerAlign`, `headerClassName` y `contentClassName` permiten adaptar una composición de formulario amplia sin duplicar overlay, foco, scroll ni botón de cierre. `footer` y `footerClassName` mantienen acciones críticas fijas fuera del área desplazable. `layerClassName` ajusta la capa del portal cuando un flujo necesita precedencia explícita. `closeLabel` resuelve su etiqueta desde i18n en el consumidor o usa `common.close`. Bloquea el scroll del body mientras está abierto.

## Uso

El contenido debe ser desplazable y sus acciones deben quedar visibles. Usar `ConfirmModal` para confirmación crítica.

## Estados y aceptación

Respeta variantes default/danger/warning/success, backdrop, foco inicial, restauración de foco, Escape y ciclo de Tab dentro del diálogo, además de viewport móvil/tablet/escritorio.
