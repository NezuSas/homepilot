# HomeConversationComposer

**Fuente:** `apps/operator-console/src/components/HomeConversationComposer.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Compone texto, voz, selección de micrófono y síntesis de voz para conversar con el hogar.

## Contrato

Recibe el texto, capacidades del navegador, etiquetas traducidas y callbacks de envío, grabación, síntesis y fuente de audio. No interpreta comandos ni conserva estado global propio.

## Uso

Usar en la vista de conversación. La vista controla el ciclo de solicitud y evita reemplazar mensajes existentes durante refresh.

## Estados y aceptación

Permanece anclado al borde inferior durante el desplazamiento, conserva el área segura móvil y permite que controles de voz se envuelvan dentro del ancho disponible. El campo mantiene el foco, expone ayuda accesible y la acción de envío no se separa del compositor. Las etiquetas de estado no se truncan en anchos reducidos.
