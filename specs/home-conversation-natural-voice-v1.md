# Home Conversation Natural Voice V1

## Objetivo
Mejorar `Conversar con mi casa` para que acepte frases humanas más naturales y permita interacción por voz desde la Operator Console, manteniendo el Edge como fuente de verdad y las confirmaciones de seguridad existentes.

## Alcance
- El backend debe tolerar prefijos, invocaciones y muletillas comunes sin cambiar contratos API.
- La UI debe permitir dictar una instrucción con micrófono cuando el navegador soporte Web Speech API.
- La UI debe poder leer respuestas del asistente usando una voz profesional gratuita sin API keys como ruta principal.
- El backend debe exponer un endpoint TTS propio que delegue en un servicio local Docker con voces neurales gratuitas.
- La UI puede usar `speechSynthesis` solo como fallback si el servicio TTS local no responde.
- La experiencia de voz no debe requerir API keys ni proveedores cloud de pago.
- Las acciones ambiguas, masivas o sensibles deben seguir usando las confirmaciones actuales.

## Fuera de Alcance
- No se agrega STT cloud.
- No se agrega TTS cloud con API key.
- No se agrega streaming de audio en tiempo real.
- No se elimina la validación determinística ni las políticas de confirmación.
- No se habilita ejecución autónoma de Planner V2.
- No se cambian contratos de dispositivos, escenas, automatizaciones ni API.

## Acceptance Criteria
- Frases como `oye homepilot me puedes apagar la luz de la sala por favor` se normalizan hacia la intención central sin requerir forma exacta.
- La caja de chat expone botón de micrófono si el navegador soporta reconocimiento de voz.
- Al terminar el dictado, el texto reconocido se envía al asistente como un prompt normal.
- La caja de chat expone botón para activar/desactivar lectura de respuestas si el navegador puede reproducir audio o usar síntesis local.
- Si una respuesta del asistente llega con lectura activada, la UI solicita audio MP3 al endpoint TTS backend.
- El endpoint TTS backend usa el servicio local `homepilot-tts` con voces neurales gratuitas y sin API key.
- Si el servicio TTS local falla, la UI usa `speechSynthesis` solo como fallback sin romper la conversación.
- Typecheck, build, build de Operator Console, tests y Docker pasan.
