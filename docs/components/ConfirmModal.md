# ConfirmModal

**Fuente:** `apps/operator-console/src/components/ConfirmModal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Solicita confirmación explícita antes de una acción sensible o destructiva.

## Contrato

Recibe apertura, título, descripción, etiquetas, callback asíncrono de confirmación y cierre. Gestiona estado de envío para impedir doble ejecución.

## Uso

Usar para borrar, desconectar, resetear o acciones con impacto. No usar para toggles simples o comandos de voz confirmados por su política.

## Estados y aceptación

La acción se bloquea durante envío; cancelar y cerrar no ejecutan la intención; las etiquetas se traducen en el consumidor.

