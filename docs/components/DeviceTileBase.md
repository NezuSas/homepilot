# DeviceTileBase

**Fuente:** `apps/operator-console/src/components/ui/DeviceTileBase.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Base visual de una tarjeta de dispositivo que unifica icono, título, subtítulo, badge, acción y estados.

## Contrato

`DeviceTileBaseProps` recibe icono, título, estado `active`, `disabled`, `error`, `syncing`, acciones y children. No consulta drivers ni decide comandos.

## Uso

Las tarjetas especializadas de luz, cortina, sensor o dispositivo reutilizan esta base y pasan únicamente acciones compatibles.

## Estados y aceptación

Disponible, activo, offline/disabled, error y syncing tienen señal visual sin depender solo del color. En móvil reduce padding, permite texto largo con ajuste seguro y mantiene las acciones contextuales visibles cuando no existe hover; en escritorio se revelan al interactuar con la tarjeta.
