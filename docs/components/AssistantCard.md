# AssistantCard

**Fuente:** `apps/operator-console/src/components/ui/AssistantCard.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Superficie reutilizable para mostrar una recomendación, hallazgo o acción del asistente sin contener lógica de IA.

## Contrato

Recibe contenido, prioridad visual y acciones derivadas por la vista o store del asistente. Asocia título y descripción para lectores de pantalla, mantiene el icono decorativo y excluye semánticamente un hallazgo descartado.

## Uso

Usar para hallazgos interpretados; no para emitir comandos directamente ni mostrar razonamiento sensible sin autorización.

## Estados y aceptación

Mantiene información, acción, vacío y loading con jerarquía compacta y traducciones del consumidor. Reduce padding en móvil y permite que categoría, severidad, texto y acciones largas se ajusten o envuelvan sin provocar overflow. Los botones directos ocupan el ancho táctil disponible en móvil y recuperan su ancho natural desde tablet. Un hallazgo con `isDismissed` no conserva foco ni contexto accesible residual.
