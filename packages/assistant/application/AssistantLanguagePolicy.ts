export type AssistantLanguage = 'es' | 'en';

export function detectAssistantLanguage(prompt: string): AssistantLanguage | null {
  const lower = prompt.toLowerCase();
  const hasAccent = /[áéíóúñÁÉÍÓÚÑ]/i.test(prompt);
  const spanishWords = ['qué', 'quién', 'por qué', 'enciende', 'apaga', 'hola', 'por favor', 'cómo', 'dónde', 'cuándo', 'que', 'quien', 'como', 'donde', 'cuando', 'gracias', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'si', 'no'];
  const spanishPhrases = ['que es', 'quien es', 'como estas', 'que puedes hacer', 'que servicios', 'quien creo'];
  const hasSpanishWord = spanishWords.some((word) => new RegExp(`(^|\\s)${word}(\\s|$|[?!.,])`, 'i').test(lower));
  if (hasAccent || hasSpanishWord || spanishPhrases.some((phrase) => lower.includes(phrase))) return 'es';
  const englishWords = ['the', 'turn', 'on', 'off', 'what', 'who', 'why', 'hello', 'hi', 'please', 'switch', 'answer', 'speak', 'created', 'company'];
  const hasEnglishWord = englishWords.some((word) => new RegExp(`(^|\\s)${word}(\\s|$|[?!.,])`, 'i').test(lower));
  return hasEnglishWord && /^[a-z0-9\s.,?!'-]+$/i.test(prompt) ? 'en' : null;
}

export function detectAssistantLanguageOverride(normalized: string): AssistantLanguage | null {
  const toEnglish = ['habla en ingles', 'responde en ingles', 'cambia a ingles', 'habla en inglés', 'responde en inglés', 'cambia a inglés'];
  const toSpanish = ['speak spanish', 'answer in spanish', 'switch to spanish', 'speak in spanish'];
  if (toEnglish.some((command) => normalized.includes(command))) return 'en';
  return toSpanish.some((command) => normalized.includes(command)) ? 'es' : null;
}