# Select

**Fuente:** `apps/operator-console/src/components/ui/Select.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Selector reutilizable de opciones tipadas para formularios y filtros.

## Contrato

Recibe opciones, valor actual, callback de cambio y estados de disponibilidad. La lista debe llegar ya filtrada por el dominio.

## Uso

Para asignar una entidad, el consumidor entrega solo entidades compatibles. No usarlo para mezclar luces, media o cámaras sin relación.

## Estados y aceptación

Soporta valor vacío, opción larga, foco, disabled y lista desplazable sin salir del viewport.

