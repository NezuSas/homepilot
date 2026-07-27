# DemoGuideOverlay

**Fuente:** `apps/operator-console/src/components/DemoGuideOverlay.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Guiar al usuario por acciones relevantes de la consola, resaltando el objetivo activo sin bloquear la navegación hacia el paso requerido.

## Contrato

Consume el estado local de la demo y una navegación opcional. Localiza el elemento objetivo, ajusta el resaltado al viewport y muestra los textos exclusivamente mediante claves i18n definidas por cada paso.

## Uso

En escritorio posiciona la explicación cerca del objetivo. En móvil mantiene la guía disponible como tarjeta inferior dentro del área segura, sin recortar controles ni ocultar la experiencia.

## Estados y aceptación

El overlay actualiza su posición ante scroll y resize, permite terminar con Escape y conserva acciones táctiles accesibles en móvil, tablet y escritorio. No atrapa foco ni bloquea scroll: la persona puede completar directamente la acción resaltada sin que la guía interfiera con la navegación.
