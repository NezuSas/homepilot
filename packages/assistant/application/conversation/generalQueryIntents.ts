

// Pure predicates for general conversational and informational prompts.

export function isDomesticSkillFollowUpPrompt(normalized: string): boolean {
  const recommendationRequests = ['cual recomiendas', 'que recomiendas', 'cual es mejor', 'which do you recommend', 'what do you recommend', 'which one is best'];
  const moreOptionsRequests = ['que mas hay', 'que otras opciones', 'muestrame mas opciones', 'what else is available', 'what other options', 'show me more options'];
  return recommendationRequests.some((request) => normalized.includes(request))
    || moreOptionsRequests.some((request) => normalized.includes(request));
}

export function isDomesticRecommendationPrompt(normalized: string): boolean {
  const recommendationRequests = ['cual recomiendas', 'que recomiendas', 'cual es mejor', 'which do you recommend', 'what do you recommend', 'which one is best'];
  return recommendationRequests.some((request) => normalized.includes(request));
}

export function isEquivalenceQuery(normalized: string): boolean {
  const triggersES = [
    'es lo mismo que decir', 'es igual a decir', 'es lo mismo que', 'es igual a',
    'quiere decir lo mismo', 'significa lo mismo', 'igual que', 'lo mismo que'
  ];
  const wordsES = ['cuarto', 'estancia', 'habitacion', 'zona', 'room', 'area', 'espacio'];

  const triggersEN = [
    'is the same as', 'is equal to', 'means the same as', 'is it the same',
    'the same as', 'same as', 'equivalent to'
  ];
  const wordsEN = ['room', 'area', 'space', 'zone', 'chamber', 'quarter'];

  const hasTrigger = triggersES.some(t => normalized.includes(t)) || triggersEN.some(t => normalized.includes(t));
  const hasWord = wordsES.some(w => normalized.includes(w)) || wordsEN.some(w => normalized.includes(w));

  return hasTrigger && hasWord;
}

export function isNameQuery(normalized: string): boolean {
  const triggers = [
    "como te llamas", "cómo te llamas", "cuál es tu nombre", "cual es tu nombre",
    "what is your name", "whats your name"
  ];
  return triggers.some(t => normalized.includes(t));
}

export function isHelpQuery(normalized: string): boolean {
  const triggers = [
    "ayuda", "help",
    "ayudame", "necesito ayuda",
    "guia", "guiame",
    "como uso esto", "como se usa esto", "como puedo usar esto"
  ];
  return triggers.some(t => normalized === t || normalized.startsWith(t + " ") || normalized.includes(t));
}

export function isPresentation(normalized: string): boolean {
  const triggers = [
    "quién eres", "quien eres", "who are you",
    "qué puedes hacer", "que puedes hacer", "preséntate", "presentate",
    "que haces", "para que sirves",
    "que sabes hacer", "que puedes controlar",
    "que comandos entiendes", "que ordenes entiendes",
    "que puedo pedirte", "que te puedo pedir",
    "como me ayudas con la casa", "como puedes ayudarme con la casa",
    "what can you do", "what do you do", "what can you control",
    "what commands do you understand", "how can you help me with the house",
    "introduce yourself"
  ];
  return triggers.some(t => normalized.includes(t));
}

export function isScopeQuery(normalized: string): boolean {
  const triggers = [
    "que puedo preguntarte", "qué puedo preguntarte", "que cosas puedo preguntar",
    "que cosas puedo decirte", "que puedo decirte",
    "como debo hablarte", "como te puedo hablar",
    "puedo preguntarte cualquier cosa", "te puedo preguntar cualquier cosa",
    "cuales son tus limites", "cuáles son tus límites", "que limites tienes", "qué límites tienes",
    "que no puedes hacer", "qué no puedes hacer",
    "what can i ask you", "can i ask you anything", "what are your limits",
    "what cant you do", "what can't you do"
  ];
  return triggers.some(t => normalized.includes(t));
}

export function isDateTimeQuery(normalized: string): boolean {
  const triggers = [
    "que fecha es hoy", "cual es la fecha", "dime la fecha", "que dia es hoy", "en que dia estamos",
    "que hora es", "dime la hora", "me dices la hora", "puedes decirme la hora", "tienes la hora",
    "es de manana", "estamos en la manana", "es de tarde", "estamos en la tarde",
    "ya es de noche", "es de noche", "estamos en la noche", "es de madrugada",
    "what date is today", "what day is it", "what time is it", "tell me the time"
  ];
  return triggers.some(t => normalized.includes(t));
}

export function isHomeSummaryQuery(normalized: string): boolean {
  return [
    'como esta la casa',
    'esta todo bien',
    'esta el sistema estable',
    'dame un resumen de la casa',
    'resumen de la casa',
    'estado general de la casa'
  ].some(trigger => normalized.includes(trigger));
}

export function isAttentionQuery(normalized: string): boolean {
  return [
    'que dispositivos necesitan atencion',
    'cuales dispositivos necesitan atencion',
    'que requiere atencion',
    'que dispositivos no estan disponibles',
    'which devices need attention',
    'which devices are unavailable'
  ].some(trigger => normalized.includes(trigger));
}

export function isRecentActivityQuery(normalized: string): boolean {
  return [
    'que cambio recientemente',
    'cuando se ejecuto por ultima vez',
    'que acciones automaticas se ejecutaron hoy'
  ].some(trigger => normalized.includes(trigger));
}

export function isConversationContextQuery(normalized: string): boolean {
  return [
    'que fue lo ultimo que te pedi',
    'repite tu ultima respuesta',
    'repetir tu ultima respuesta'
  ].some(trigger => normalized.includes(trigger));
}

export function isGreeting(normalized: string): boolean {
  const greetings = [
    "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
    "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "gracias", "thanks", "thank you"
  ];
  return greetings.some(g => normalized === g || normalized.startsWith(g + " "));
}

export function isWellnessQuery(normalized: string): boolean {
  const triggers = [
    "como estas", "como stas", "comoe stas", "como te va", "que tal", "q tal", "todo bien", "que tal todo",
    "estas funcionando correctamente", "funcionas correctamente", "estas listo", "estas lista", "estas ahi", "me escuchas",
    "how are you", "how's it going", "hows it going", "are you ok", "how are u"
  ];
  return triggers.some(t => normalized === t || normalized.startsWith(t + " "));
}

export function isLikelyHomeControlPrompt(normalized: string): boolean {
  const conversationalPrefixes = [
    'que opinas', 'dime', 'cuentame', 'como funciona', 'explicame', 'hablame', 'sabes algo'
  ];
  if (conversationalPrefixes.some(prefix => normalized.includes(prefix))) {
    return false;
  }

  const triggers = [
    'prende', 'apaga', 'enciende', 'prenda', 'prendas', 'apague', 'apagues', 'encienda', 'enciendas', 'prender', 'apagar', 'encender', 'quita la', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'toggle', 'turn on', 'turn off', 'open', 'close',
    'deten', 'detener', 'deja', 'posicion', 'por ciento',
    'encendido', 'apagado', 'prendido', 'on', 'off', 'luz', 'luces', 'light', 'lights', 'cortina', 'cortinas', 'dispositivos', 'estado', 'modo',
    'esa', 'eso', 'esas', 'esos', 'that', 'those', 'them',
    'escena', 'rutina', 'automatizacion', 'scene', 'routine', 'automation',
    'cuando diga', 'llama a', 'when i say',
    'crea', 'haz', 'create', 'make',
    'por qué', 'qué pasó', 'que paso', 'falló', 'fallo', 'revisa', 'why', 'what happened', 'failed', 'check',
    'reintenta', 'prueba otra vez', 'intenta de nuevo', 'retry', 'try again',
    'por que', 'que paso', 'porque fallo', 'por que fallo', 'no prendio', 'no encendio', 'no se prendio', 'no se encendio', 'no apago', 'no se apago', 'reintentar', 'vuelve a intentar'
  ];
  return triggers.some(t => normalized.includes(t));
}

export function isCompanyQuery(normalized: string): boolean {
  const keywords = [
    'nezu', 'nezu sas', 'nezu s.a.s.', 'nezu ecuador',
    'que es nezu', 'quien es nezu', 'qué es nezu', 'quién es nezu',
    'quien creo homepilot', 'quién creó homepilot', 'quien hizo homepilot', 'quién hizo homepilot', 'quien desarrollo homepilot', 'quién desarrolló homepilot',
    'que hace nezu', 'qué hace nezu', 'que servicios ofrece nezu', 'qué servicios ofrece nezu', 'empresa nezu',
    'what is nezu', 'who is nezu', 'who created homepilot', 'what does nezu do', 'nezu company',
    // Legacy compatibility for "Creator" queries
    'quien te creo', 'quién te creó', 'quien te hizo', 'quién te hizo', 'quien te desarrollo', 'quién te desarrolló',
    'who created you', 'who made you', 'who developed you'
  ];
  return keywords.some(k => normalized.includes(k));
}
