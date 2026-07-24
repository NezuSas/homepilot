# HomeConversationHeader

**Fuente:** `apps/operator-console/src/components/HomeConversationHeader.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Presentar el contexto operativo de la conversación, su estado y la cantidad de mensajes sin acoplarse al transporte del asistente.

## Contrato

Recibe título, subtítulo, estado de carga y cantidad de mensajes desde la vista consumidora. Las etiquetas estáticas se resuelven con i18n dentro del componente.

## Estados y aceptación

El título y el subtítulo admiten texto largo sin truncado horizontal. Los indicadores de Edge, ejecución local, estado y conteo se adaptan al ancho disponible y conservan etiquetas localizadas.
