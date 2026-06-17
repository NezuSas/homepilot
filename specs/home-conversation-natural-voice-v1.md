# Home Conversation Natural Voice V1

## Objetivo
Mejorar `Conversar con mi casa` para que acepte frases humanas más naturales y permita interacción por voz desde la Operator Console, manteniendo el Edge como fuente de verdad y las confirmaciones de seguridad existentes.

## Alcance
- El backend debe tolerar prefijos, invocaciones y muletillas comunes sin cambiar contratos API.
- El backend debe detectar comandos aunque el verbo no sea la primera palabra de la frase.
- La UI debe permitir dictar una instrucción con micrófono grabando audio local con `MediaRecorder`.
- La UI debe enviar el audio al backend para transcripción local y no depender de Web Speech API.
- La UI debe habilitar dictado solo en contexto seguro y mostrar errores específicos de permisos, hardware o transcripción.
- La UI debe permitir elegir el dispositivo de entrada cuando el navegador reporte más de un micrófono.
- El selector de micrófono debe ser un componente modular propio, consistente en modo claro y oscuro, sin depender del menú nativo del sistema operativo.
- La UI debe cortar la grabación automáticamente después de detectar voz y silencio para reducir latencia.
- La UI debe poder leer respuestas del asistente usando una voz profesional gratuita sin API keys como ruta principal.
- El backend debe exponer un endpoint TTS propio que delegue en un servicio local Docker con Piper.
- La UI no debe usar `speechSynthesis` para leer respuestas del asistente.
- La experiencia de voz no debe requerir API keys ni proveedores cloud de pago.
- El backend debe exponer un endpoint STT propio que delegue en un servicio local Docker con Whisper.
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
- Frases como `cuando puedas apaga la luz de la sala` y `me ayudas a encender la luz de cocina` ejecutan la misma ruta segura que `apaga luz sala` o `enciende luz cocina`.
- La caja de chat expone botón de micrófono si el navegador permite grabación local de audio.
- La caja de chat expone selector de micrófono cuando hay múltiples entradas disponibles.
- El selector de micrófono trunca nombres largos, mantiene tamaño estable y muestra opciones legibles en modo oscuro.
- Al terminar la grabación, el audio se transcribe en el servicio local `homepilot-stt` y el texto resultante se envía al asistente como un prompt normal.
- El servicio local de STT debe usar un perfil balanceado por defecto: `WHISPER_MODEL=small`, `WHISPER_COMPUTE_TYPE=int8`, `WHISPER_BEAM_SIZE=3` y VAD configurable para mejorar comprensión natural sin abandonar ejecución local.
- El modelo de STT debe permanecer configurable por variables de entorno para permitir perfiles `tiny/base` en hardware limitado o modelos superiores en equipos más potentes.
- La grabación se detiene por silencio o por límite máximo, sin obligar al usuario a esperar el timeout completo.
- La caja de chat expone botón para activar/desactivar lectura de respuestas si el navegador puede reproducir audio o usar síntesis local.
- Si una respuesta del asistente llega con lectura activada, la UI solicita audio WAV al endpoint TTS backend.
- El endpoint TTS backend usa el servicio local `homepilot-tts` con Piper y la voz oficial `es_ES-davefx-medium` por defecto.
- El servicio TTS debe mantener Piper cargado en memoria para evitar arrancar un proceso por cada respuesta.
- Si el servicio TTS local falla, la conversación sigue funcionando en texto sin reproducir la voz del navegador.
- Si el servicio STT local falla, la conversación sigue funcionando por texto sin depender del reconocimiento de voz del navegador.
- Typecheck, build, build de Operator Console, tests y Docker pasan.
