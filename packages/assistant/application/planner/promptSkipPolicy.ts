const LANGUAGE_OVERRIDE_PROMPTS = [
  'habla en español', 'habla en ingles', 'habla en inglés', 'speak in english', 'speak in spanish',
  'english', 'spanish', 'español', 'ingles', 'inglés',
];

export type PromptSkipReason = 'empty_prompt' | 'internal_selection' | 'language_override';

/**
 * Prompts que Planner V2 (sombra o ejecución) nunca debe evaluar: vacíos,
 * selecciones internas del cliente y cambios de idioma.
 */
export function getPromptSkipReason(prompt: string): PromptSkipReason | null {
  const lowerPrompt = prompt.trim().toLowerCase();
  if (!lowerPrompt) return 'empty_prompt';
  if (lowerPrompt.startsWith('selected:')) return 'internal_selection';
  if (lowerPrompt.startsWith('selection:')) return 'internal_selection';
  if (LANGUAGE_OVERRIDE_PROMPTS.includes(lowerPrompt)) return 'language_override';
  return null;
}

const PRONOUN_PROMPT_PATTERN = /^(enci[eé]ndel[ao]s?|pr[eé]ndel[ao]s?|ap[aá]gal[ao]s?|es[ao]s?|la misma|el mismo|los mismos|las mismas|it|them)$/;

/** Indica si el prompt es una referencia pronominal ("apágalo", "them") que depende de memoria corta. */
export function isPronounPrompt(prompt: string): boolean {
  return PRONOUN_PROMPT_PATTERN.test(prompt.trim().toLowerCase());
}
