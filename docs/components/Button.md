# Button

**Fuente:** `apps/operator-console/src/components/ui/Button.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Acción textual principal, secundaria, neutra o destructiva. Se usa para confirmar una intención; no para navegación puramente icónica.

## Contrato

`ButtonProps` extiende atributos nativos de botón y añade `variant`, `size` e `isLoading`. `isLoading` deshabilita la acción y muestra el indicador sin cambiar su tamaño. `size="md"` comparte la altura base `h-10` de `Input` para acciones textuales en línea.

## Uso

Usar `primary` para la acción principal, `danger` solo para operación destructiva y `IconButton` cuando no haya texto visible. Los selectores, tabs, tarjetas interactivas y controles de arrastre conservan sus componentes semánticos especializados. El texto proviene de i18n del consumidor.

## Estados y aceptación

Soporta normal, hover/focus, disabled y loading; mantiene foco visible y área táctil definida por tokens. Las etiquetas pueden ajustarse dentro del ancho disponible sin estirar filas, tarjetas o modales.
