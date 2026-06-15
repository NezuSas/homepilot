# Home Conversation Natural Voice V1

## Objetivo
Mejorar `Conversar con mi casa` para que acepte frases humanas más naturales y permita interacción por voz desde la Operator Console, manteniendo el Edge como fuente de verdad y las confirmaciones de seguridad existentes.

## Alcance
- El backend debe tolerar prefijos, invocaciones y muletillas comunes sin cambiar contratos API.
- La UI debe permitir dictar una instrucción con micrófono cuando el navegador soporte Web Speech API.
- La UI debe poder leer respuestas del asistente con `speechSynthesis` cuando el navegador lo soporte.
- Las acciones ambiguas, masivas o sensibles deben seguir usando las confirmaciones actuales.

## Fuera de Alcance
- No se agrega STT/TTS cloud.
- No se elimina la validación determinística ni las políticas de confirmación.
- No se habilita ejecución autónoma de Planner V2.
- No se cambian contratos de dispositivos, escenas, automatizaciones ni API.

## Acceptance Criteria
- Frases como `oye homepilot me puedes apagar la luz de la sala por favor` se normalizan hacia la intención central sin requerir forma exacta.
- La caja de chat expone botón de micrófono si el navegador soporta reconocimiento de voz.
- Al terminar el dictado, el texto reconocido se envía al asistente como un prompt normal.
- La caja de chat expone botón para activar/desactivar lectura de respuestas si el navegador soporta síntesis de voz.
- Si una respuesta del asistente llega con lectura activada, se reproduce por voz.
- Typecheck, build, build de Operator Console, tests y Docker pasan.
