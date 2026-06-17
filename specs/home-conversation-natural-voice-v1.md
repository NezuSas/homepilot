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
- La UI debe permitir un modo de activador local `HomePilot` mientras la consola esté abierta y tenga permiso de micrófono.
- La UI no debe bloquear frases naturales de varias palabras por no coincidir con una lista rígida de keywords; el backend conserva la responsabilidad de resolver intención o responder que no entendió.
- La captura manual del chat y el activador global deben compartir utilidades de audio comunes para evitar divergencias de comportamiento.
- La UI debe mostrar estado global discreto de escucha, captura, transcripción, procesamiento y respuesta cuando el activador esté disponible.
- La UI debe registrar telemetría local de latencia para activador global, procesamiento y reproducción de voz sin enviar datos a servicios externos.
- La UI no debe mostrar toasts repetidos por ciclos pasivos de escucha global; solo captura activa, transcripción, procesamiento, fallos o entrega final de voz pueden ser visibles.
- La UI no debe previsualizar la respuesta completa del asistente fuera de la vista de conversación; los avisos ambientales deben usar estados genéricos mientras TTS reproduce el detalle.
- Las vistas pesadas de la Operator Console deben poder cargarse de forma diferida para reducir el bundle inicial.
- La guía de producto debe explicar que la voz es local, que requiere permiso de micrófono, que el activador funciona con la consola abierta y que las acciones sensibles conservan confirmación.
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
- Frases cortas de cortesía como `hola` no deben descartarse por tener una sola palabra.
- El activador local debe reconocer `HomePilot`/`oye HomePilot` y variantes fonéticas en español como `ok jompailot`, comenzando captura de orden sin requerir presionar el botón de micrófono cada vez.
- Si el activador recibe una frase completa, como `HomePilot apaga la luz de la sala`, debe enviar directamente la orden normalizada.
- Si el activador global abre la vista de conversación con una orden pendiente, la respuesta debe habilitar lectura por voz antes de enviar el prompt.
- La captura global debe tolerar aproximadamente un segundo adicional de silencio final para evitar cortar frases habladas con pausas naturales.
- Si el activador global se usa desde otra pantalla, HomePilot no debe forzar navegación al chat; debe procesar la orden en segundo plano, mostrar una respuesta discreta y reproducir voz si el navegador lo permite.
- Frases con activador fonético o separado, como `ok jompailot apaga la luz de la sala` u `ok home pilot apaga el territorio`, deben normalizar el prefijo antes de evaluar la intención.
- Comandos de control con verbo claro pero destino inexistente deben responder por ruta determinística rápida, sin esperar interpretación pesada.
- Las respuestas de ejecución, error, objetivo no encontrado, aclaración y bloqueo de seguridad deben poder adjuntar metadato opcional `responseStyle` y formatearse con tono residencial tipo Jarvis sin afirmar acciones no confirmadas.
- El tono tipo Jarvis debe sonar como un operador residencial premium: natural, breve, sereno y seguro, evitando lenguaje técnico como "dispositivo ha sido..." cuando pueda expresarse como una acción humana.
- Preguntas conversacionales cortas como `ok jompailot cómo estás` o `ok jompailot qué hora es` deben responder de forma útil y enfocada en la casa, no como charla genérica desconectada del sistema residencial.
- Frases como `cuando puedas apaga la luz de la sala` y `me ayudas a encender la luz de cocina` ejecutan la misma ruta segura que `apaga luz sala` o `enciende luz cocina`.
- Frases naturales de varias palabras deben llegar al backend aunque no contengan una keyword exacta conocida; solo deben descartarse capturas vacías o de bajo valor como ruido.
- La grabación manual y la escucha global usan la misma implementación base para soporte de `MediaRecorder`, selección de MIME y conversión base64.
- El activador global muestra un indicador no intrusivo cuando está escuchando, capturando, transcribiendo o respondiendo.
- El flujo global registra tiempos de detección, resolución y reproducción para diagnosticar latencia de voz local.
- El shell carga vistas por demanda con `React.lazy`/`Suspense` sin cambiar rutas ni contratos.
- Las respuestas rápidas de saludo, estado del asistente y nombre se delegan a un helper modular testeado.
- El onboarding comercial debe comunicar capacidades y límites de voz sin prometer ejecución autónoma fuera de la consola abierta.
- La caja de chat expone botón de micrófono si el navegador permite grabación local de audio.
- La caja de chat expone selector de micrófono cuando hay múltiples entradas disponibles.
- El selector de micrófono trunca nombres largos, mantiene tamaño estable y muestra opciones legibles en modo oscuro.
- Al terminar la grabación, el audio se transcribe en el servicio local `homepilot-stt` y el texto resultante se envía al asistente como un prompt normal.
- El servicio local de STT debe usar un perfil balanceado por defecto: `WHISPER_MODEL=small`, `WHISPER_COMPUTE_TYPE=int8`, `WHISPER_BEAM_SIZE=3` y VAD configurable para mejorar comprensión natural sin abandonar ejecución local.
- El modelo de STT debe permanecer configurable por variables de entorno para permitir perfiles `tiny/base` en hardware limitado o modelos superiores en equipos más potentes.
- La grabación se detiene por silencio o por límite máximo, sin obligar al usuario a esperar el timeout completo.
- La caja de chat expone botón para activar/desactivar lectura de respuestas si el navegador puede reproducir audio o usar síntesis local.
- Si una respuesta del asistente llega con lectura activada, la UI solicita audio WAV al endpoint TTS backend.
- El endpoint TTS backend usa el servicio local `homepilot-tts` con Piper y la voz oficial `es_ES-sharvard-medium` por defecto, configurable por `PIPER_VOICE_ES`.
- El servicio TTS debe mantener Piper cargado en memoria para evitar arrancar un proceso por cada respuesta.
- Si el servicio TTS local falla, la conversación sigue funcionando en texto sin reproducir la voz del navegador.
- Si el servicio STT local falla, la conversación sigue funcionando por texto sin depender del reconocimiento de voz del navegador.
- Typecheck, build, build de Operator Console, tests y Docker pasan.
