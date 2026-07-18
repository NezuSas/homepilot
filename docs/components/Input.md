# Input

**Fuente:** `apps/operator-console/src/components/ui/Input.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Campo de texto reutilizable para datos simples controlados por la vista.

## Contrato

Extiende atributos nativos de `input`, con variantes visuales comunes. Su valor, validación y mensaje de negocio pertenecen al consumidor.

## Uso

Usar con label accesible, placeholder traducido y estado de error explicado fuera o junto al campo. Se aplica a campos generales de texto, contraseña e identidad. No reemplaza rangos, archivos, áreas de texto, búsqueda contextual ni entradas especializadas del dominio.

## Estados y aceptación

Vacío, foco, valor, disabled y error mantienen contraste, foco visible y soporte de texto largo.
