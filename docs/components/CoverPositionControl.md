# CoverPositionControl

**Fuente:** `apps/operator-console/src/components/CoverPositionControl.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Controlar la posición porcentual de una cortina o persiana compatible.

## Contrato

Recibe `initialPosition`, `onPositionChange`, `disabled` y `ariaLabel` obligatorio. El callback se dispara solo al confirmar una posición distinta mediante mouse, touch, blur o teclado.

## Uso

Usar únicamente cuando las capacidades del cover incluyen posición. El consumidor traduce `ariaLabel` y despacha el comando.

## Estados y aceptación

Muestra 0–100%, sincroniza cambios externos y no ejecuta comandos repetidos para el mismo valor. No introduce etiquetas por defecto en un idioma fijo: el consumidor siempre entrega la traducción accesible.
