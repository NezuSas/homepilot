# SelectField

**Fuente:** `apps/operator-console/src/components/ui/SelectField.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Campo de formulario que compone etiqueta, ayuda, estado y `Select` con la misma escala visual.

## Contrato

Recibe el contrato del selector y los metadatos de formulario. No valida reglas de negocio ni obtiene entidades.

## Uso

Usar en formularios que requieran etiqueta y ayuda persistentes; usar `Select` cuando el contexto ya provee etiqueta externa.

## Estados y aceptación

Etiqueta, ayuda, error, disabled y opciones extensas no se superponen ni se recortan.

