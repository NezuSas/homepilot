# HomeConversationMessages

**Fuentes:** `apps/operator-console/src/components/HomeConversationMessageBubble.tsx`, `HomeConversationTypingIndicator.tsx`, `HomeConversationEmptyState.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Representar el estado inicial, los mensajes y la actividad de escritura de la conversación con la casa mediante la misma jerarquía tipográfica, acciones y superficies compartidas.

## Contrato

Las burbujas reciben un mensaje tipado y un callback para sus opciones. El estado inicial recibe textos y sugerencias desde su vista consumidora. Los tres componentes resuelven sus etiquetas propias mediante i18n y no conocen el endpoint o la lógica de conversación.

## Estados y aceptación

Los textos largos se ajustan sin truncar opciones accionables, los mensajes conservan `text-body` en todos los breakpoints y el indicador de escritura anuncia su estado con `role=status`. El avatar de usuario usa una etiqueta localizada cuando no hay perfil disponible.
