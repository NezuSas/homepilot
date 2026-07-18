# Textarea

**Fuente:** `apps/operator-console/src/components/ui/Textarea.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Campo multilínea reutilizable para contenido editable general, con etiqueta accesible, foco, error y mensaje auxiliar consistentes.

## Contrato

Extiende los atributos nativos de `textarea`. `containerClassName` controla el layout del contenedor y `className` modifica únicamente el área editable. Si recibe `label`, genera y asocia un `id` accesible automáticamente.

## Uso

Usar para texto general de varias líneas, como el contenido editable del título de un tablero. Mantener el texto visible traducido en el consumidor. No reemplaza el compositor conversacional: ese control administra voz, envío, atajos de teclado y altura operativa propios.

## Estados y aceptación

Vacío, foco, valor, disabled y error conservan contraste, foco visible y soporte de texto largo sin overflow horizontal.
