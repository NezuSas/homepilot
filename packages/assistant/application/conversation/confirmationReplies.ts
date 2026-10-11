import { DeviceCommandV1 } from '../../../devices/domain/commands';
import type { Intent } from '../ports/IntentInterpreterPort';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';

// Pure helpers that classify confirmation, selection and pronoun replies.

/** Expiration window for a legacy pending conversational clarification. */
const PENDING_INTENT_CONFIRMATION_TTL_MS = 300_000;

export function isPendingIntentConfirmationActive(pendingIntent: NonNullable<AssistantMemoryState['pendingIntent']>): boolean {
  const pendingAt = new Date(pendingIntent.timestamp).getTime();
  if (!Number.isFinite(pendingAt)) return false;

  const elapsed = Date.now() - pendingAt;
  return elapsed >= 0 && elapsed < PENDING_INTENT_CONFIRMATION_TTL_MS;
}

const DALE_COURTESY = new Set(['gracias', 'por favor', 'porfa', 'nomas', 'no mas', 'pues', 'ya', 'ahora', 'ahora mismo', 'listo', 'hazlo', 'adelante']);

/** True when the utterance starts with the trigger as a reply; "dale" followed by an object is a request, not a reply. */
function startsWithReply(normalized: string, trigger: string): boolean {
  if (normalized === trigger) return true;
  if (!normalized.startsWith(trigger + ' ')) return false;
  if (trigger !== 'dale') return true;
  return DALE_COURTESY.has(normalized.slice(trigger.length + 1).trim());
}

export function isConfirmation(normalized: string): boolean {
  const triggers = [
    'si', 'dale', 'confirmo', 'adelante', 'procede', 'ok', 'vale', 'confirmar', 'ejecutar',
    'yes', 'go ahead', 'confirm', 'proceed', 'execute', 'do it', 'sure',
    'no', 'cancela', 'cancelar', 'abortar', 'noup', 'negativo',
    'cancel', 'abort', 'nope', 'negative'
  ];
  return triggers.some(t => startsWithReply(normalized, t));
}

export function isPositiveConfirmation(normalized: string): boolean {
  const positives = [
    'si', 'dale', 'confirmo', 'adelante', 'procede', 'ok', 'vale', 'confirmar', 'ejecutar',
    'yes', 'go ahead', 'confirm', 'proceed', 'execute', 'do it', 'sure'
  ];
  return positives.some(t => startsWithReply(normalized, t));
}

export function isNegativeConfirmation(normalized: string): boolean {
  const negatives = [
    'no', 'cancela', 'cancelar', 'abortar', 'noup', 'negativo',
    'cancel', 'abort', 'nope', 'negative'
  ];
  return negatives.some(t => normalized === t || normalized.startsWith(t + ' '));
}

export function resolveSelectionFromMemory(text: string, options: { id: string; label: string }[], language: string): string | null {
  let normalized = normalizeAssistantPrompt(text);
  if (normalized.startsWith('seleccione ')) normalized = normalized.replace('seleccione ', '').trim();
  if (normalized.startsWith('selected ')) normalized = normalized.replace('selected ', '').trim();

  // Check exact ID match first
  const exactId = options.find(opt => opt.id === text);
  if (exactId) return exactId.id;

  // Check indices
  const indexTriggers = [
    { triggers: ['la primera', 'el primero', 'primera', 'primero', 'the first', 'first one', '1st', 'primera'], index: 0 },
    { triggers: ['la segunda', 'el segundo', 'segunda', 'segundo', 'the second', 'second one', '2nd'], index: 1 },
    { triggers: ['la tercera', 'el tercero', 'tercera', 'tercero', 'the third', 'third one', '3rd'], index: 2 },
  ];

  for (const group of indexTriggers) {
    if (group.triggers.some(t => normalized === t || normalized.includes(t))) {
      if (options[group.index]) return options[group.index].id;
    }
  }

  // Exact candidate label match
  const exactLabel = options.find(opt => normalizeAssistantPrompt(opt.label) === normalized);
  if (exactLabel) return exactLabel.id;

  // Partial label match (e.g. "luz sala")
  const partialLabel = options.find(opt => {
    const optLabel = normalizeAssistantPrompt(opt.label);
    return normalized.includes(optLabel) || optLabel.includes(normalized);
  });
  if (partialLabel) return partialLabel.id;

  return null;
}

export function inferCommandFromPrompt(prompt: string): DeviceCommandV1 | undefined {
  const normalized = normalizeAssistantPrompt(prompt);
  // Explicit keywords
  if (normalized.includes('cierra') || normalized.includes('cerrar') || normalized.includes('close')) return 'close';
  if (normalized.includes('abre') || normalized.includes('abrir') || normalized.includes('open')) return 'open';
  if (normalized.includes('apaga') || normalized.includes('apagar') || normalized.includes('off')) return 'turn_off';
  if (normalized.includes('enciende') || normalized.includes('encender') || normalized.includes('prende') || normalized.includes('prender') || normalized.includes('on')) return 'turn_on';

  // English phrases
  if (normalized.includes('turn off')) return 'turn_off';
  if (normalized.includes('turn on')) return 'turn_on';

  return undefined;
}

export function isSuggestionAccept(normalized: string): boolean {
  const acceptTriggers = ['si', 'sí', 'si creala', 'sí, créala', 'dale', 'crear', 'hazlo', 'yes', 'create it', 'do it'];
  return acceptTriggers.includes(normalized) || acceptTriggers.some(t => normalized.startsWith(t + ' '));
}

export function isSuggestionReject(normalized: string): boolean {
  const rejectTriggers = ['no', 'no gracias', 'descartar', 'no thanks', 'dismiss'];
  return rejectTriggers.includes(normalized) || rejectTriggers.some(t => normalized.startsWith(t + ' '));
}

export function isSuggestionPostpone(normalized: string): boolean {
  const postponeTriggers = ['despues', 'después', 'recuerdamelo despues', 'recuérdamelo después', 'mas tarde', 'más tarde', 'later', 'remind me later'];
  return postponeTriggers.includes(normalized) || postponeTriggers.some(t => normalized.startsWith(t + ' '));
}

export function isBulkActionAccept(normalized: string): boolean {
  const triggers = ['si', 'sí', 'confirmar', 'dale', 'ok', 'yes', 'confirm', 'proceed'];
  return triggers.includes(normalized);
}

export function isBulkActionReject(normalized: string): boolean {
  const triggers = ['no', 'cancelar', 'no gracias', 'cancel', 'no thanks'];
  return triggers.includes(normalized);
}

export async function resolvePronounIntent(normalized: string, memory: AssistantMemoryState | null, language: string): Promise<Intent | { type: 'clarificationRequired'; options: Array<{ id: string; label: string; kind: 'device' | 'scene' }> } | null> {
  const patterns = [
    { regex: /(^|\s)(apagal[ao]s?|apaga esa|apaga la misma)(\s|$)/, command: 'turn_off' as const },
    { regex: /(^|\s)(enciendel[ao]s?|enciende esa|enciende la misma|prendel[ao]s?|prende esa|prende la misma)(\s|$)/, command: 'turn_on' as const },
  ];

  const match = patterns.find(p => p.regex.test(normalized));
  if (!match) return null;

  // Only resolve pronouns if the last interaction was a command (Requirement A)
  if (!memory || memory.lastQueryType !== 'command' || !memory.entities || memory.entities.length === 0) {
    return null;
  }

  if (memory.entities.length > 1) {
    // Return clarification ONLY with the entities from the last command context (Requirement A.2)
    return {
      type: 'clarificationRequired',
      options: memory.entities.map(e => ({
        id: e.id,
        label: e.name,
        kind: 'device' // Pronoun resolution always refers to devices/scenes from last command
      }))
    };
  }

  const entity = memory.entities[0];
  return {
    type: 'command',
    deviceId: entity.id,
    command: match.command,
    params: {},
    prompt: normalized
  };
}
