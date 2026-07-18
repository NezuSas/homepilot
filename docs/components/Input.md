# Input

**Fuente:** `apps/operator-console/src/components/ui/Input.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Campo de texto reutilizable para datos simples controlados por la vista.

## Contrato

Extiende atributos nativos de `input`, con variantes visuales comunes. Su valor, validación y mensaje de negocio pertenecen al consumidor.

## Uso

Usar con label accesible, placeholder traducido y estado de error explicado fuera o junto al campo. No crear inputs visualmente duplicados.

## Estados y aceptación

Vacío, foco, valor, disabled y error mantienen contraste, foco visible y soporte de texto largo.

