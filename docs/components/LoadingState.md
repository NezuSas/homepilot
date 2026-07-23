# LoadingState

**Fuente:** `apps/operator-console/src/components/ui/LoadingState.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Presentar una carga inicial de forma uniforme, accesible y traducible, sin mezclar implementaciones de spinners entre vistas.

## Contrato

Recibe un `label` ya traducido, una escala `sm`, `md` o `lg` y atributos estándar de contenedor. Expone `role="status"`, anuncia cambios mediante `aria-live` y marca el icono como decorativo.

## Uso

Usar únicamente mientras una vista aún no tiene datos que mostrar. Durante un refresh posterior se debe mantener la información previa visible y usar feedback localizado si hace falta.

## Estados y aceptación

Mantiene centrado, escala tipográfica y contraste mediante tokens de diseño. No consulta datos, no crea estado global y no contiene texto hardcodeado.
