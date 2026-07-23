# Input

**Fuente:** `apps/operator-console/src/components/ui/Input.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Campo de texto reutilizable para datos simples controlados por la vista.

## Contrato

Extiende atributos nativos de `input`, con variantes visuales comunes. `containerClassName` controla el ancho o el comportamiento del contenedor dentro de formularios en fila; `className` solo personaliza el elemento de entrada. Cuando se proporciona `label`, genera y asocia un `id` accesible automáticamente. Su valor, validación y mensaje de negocio pertenecen al consumidor.

## Uso

Usar con label accesible, placeholder traducido y estado de error explicado fuera o junto al campo. Se aplica a campos generales de texto, contraseña, identidad, onboarding, nombres de hogar/estancia y escenas. `SearchInput` se usa para búsquedas modulares simples. No reemplaza rangos, archivos, áreas de texto, radios ni entradas especializadas del dominio. Cuando comparte una fila con una acción primaria, usar `Button size="md"` o `IconButton` con `h-10 w-10`, para conservar la altura base de `h-10` del campo.

## Estados y aceptación

Vacío, foco, valor, disabled y error mantienen contraste, foco visible y soporte de texto largo. Su contenedor y control pueden reducirse dentro de grids o filas flexibles; etiquetas y ayudas largas se ajustan sin desborde horizontal.
