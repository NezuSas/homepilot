import { getAssistantResponseText } from './AssistantResponseCatalog';

export type AssistantResponsePreference = 'concise' | 'standard' | 'detailed';
export type AssistantResponseLanguage = 'es' | 'en';

export const ASSISTANT_RESPONSE_PREFERENCE_KEY = 'assistant_response_style';

const responsePreferenceCommands: ReadonlyArray<
  readonly [AssistantResponsePreference, readonly string[]]
> = [
  [
    'concise',
    [
      'responde breve',
      'respondeme breve',
      'respóndeme breve',
      'responde corto',
      'sin vueltas',
      've al grano',
      'se breve',
      'sé breve',
      'be brief',
      'keep it short',
      'get to the point',
      'be concise'
    ]
  ],
  [
    'standard',
    [
      'responde normal',
      'respuesta normal',
      'modo normal',
      'respond normally',
      'normal response',
      'normal mode'
    ]
  ],
  [
    'detailed',
    [
      'dame mas detalle',
      'dame más detalle',
      'explicame mas',
      'explícame más',
      'amplia la respuesta',
      'amplía la respuesta',
      'entra en detalle',
      'responde detallado',
      'more detail',
      'more context',
      'explain more',
      'expand',
      'detailed response'
    ]
  ]
];

export function isAssistantResponsePreference(
  value: string | null | undefined
): value is AssistantResponsePreference {
  return value === 'concise' || value === 'standard' || value === 'detailed';
}

export function detectAssistantResponsePreferenceCommand(
  normalizedPrompt: string
): AssistantResponsePreference | null {
  const normalized = normalizePreferencePhrase(normalizedPrompt);

  return responsePreferenceCommands.find(([, commands]) =>
    commands.some((command) => normalized.includes(normalizePreferencePhrase(command)))
  )?.[0] ?? null;
}

export function getAssistantResponsePreferenceAcknowledgement(
  preference: AssistantResponsePreference,
  language: AssistantResponseLanguage
): string {
  return getAssistantResponseText('preference.response_style', language, { preference });
}

export function applyAssistantResponsePreference(
  message: string,
  preference: AssistantResponsePreference,
  language: AssistantResponseLanguage
): string {
  const trimmed = message.trim();
  if (!trimmed || preference === 'standard') {
    return message;
  }

  if (preference === 'concise') {
    return makeConcise(trimmed);
  }

  if (trimmed.length >= 420 || /puedo ampliar|can expand/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}${getAssistantResponseText('preference.detail_offer', language, {})}`;
}

function makeConcise(text: string): string {
  const firstSentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? text;
  return firstSentence.length <= 220
    ? firstSentence
    : `${firstSentence.slice(0, 217).trimEnd()}…`;
}

function normalizePreferencePhrase(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}