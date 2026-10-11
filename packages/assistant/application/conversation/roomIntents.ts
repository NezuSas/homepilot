import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';

// Pure predicates and extractors for room queries and room management prompts.

/**
 * Determines if a device supports the given command.
 * Uses a type-based check as primary filter, then validates via domain capabilities.
 * The type-based check runs first to handle HA devices or devices without explicit capabilities.
 */
export function isRoomQuery(normalized: string): boolean {
  const triggers = [
    'que estancias conoces', 'que estancia conoces', 'que estancia nomas conoces',
    'que cuartos conoces', 'que habitaciones tienes', 'que zonas conoces',
    'que estancias tengo', 'que estancia tengo', 'que espacios tengo', 'que espacio tengo',
    'que habitaciones tengo', 'que habitacion tengo', 'que cuartos tengo', 'que cuarto tengo', 'que zonas tengo', 'que zona tengo',
    'que estancias o espacios tengo', 'que espacios o estancias tengo',
    'what rooms do you know', 'what areas do you know', 'what rooms do i have', 'list rooms'
  ];
  return triggers.some(trigger => normalized.includes(trigger));
}

export function isRoomCreationIntent(normalized: string): boolean {
  const hasCreationVerb = /(?:^|\s)(?:crea|crear|agrega|agregar|anade|anadir|add|create)(?:\s|$)/.test(normalized);
  const hasRoomTerm = /(?:^|\s)(?:estancia|habitacion|cuarto|espacio|zona|room)(?:\s|$)/.test(normalized);
  const targetsDraft = /(?:^|\s)(?:escena|rutina|automatizacion|scene|routine|automation)(?:\s|$)/.test(normalized);
  return hasCreationVerb && hasRoomTerm && !targetsDraft;
}

export function isRoomCreationFollowUp(normalized: string, memory: AssistantMemoryState | null): boolean {
  if (memory?.lastQueryType !== 'room_inventory') return false;
  return /^(?:puedo|podemos|puedes|puede) (?:agregar|anadir|crear) otra(?: (?:estancia|habitacion|cuarto|zona|room))?$/.test(normalized);
}

export function extractRoomCreationName(prompt: string): string | null {
  const match = prompt.match(/(?:^|\s)(?:crea(?:r)?|agrega(?:r)?|anade(?:r)?|añade(?:r)?|add|create)\s+(?:(?:una?|la|el|otra)\s+)?(?:nueva\s+)?(?:estancia|habitacion|habitación|cuarto|espacio|zona|room)(?:\s+(?:llamada|llamado|de nombre|named|called))?\s+(.+)$/i);
  if (!match) return null;

  const name = match[1].trim().replace(/[.?!]+$/, '').trim();
  return ['nueva', 'otra'].includes(normalizeAssistantPrompt(name)) ? null : name;
}

export function isRoomRenameIntent(normalized: string): boolean {
  return /(?:^|\s)(?:renombra|rename|cambia el nombre de|cambia de nombre|change name of)(?:\s|$)/.test(normalized) &&
    /(?:^|\s)(?:estancia|habitacion|cuarto|espacio|zona|room)(?:\s|$)/.test(normalized);
}

export function isRoomDeletionIntent(normalized: string): boolean {
  return /(?:^|\s)(?:elimina|eliminar|borra|borrar|quita|quitar|delete|remove)(?:\s|$)/.test(normalized) &&
    /(?:^|\s)(?:estancia|habitacion|cuarto|espacio|zona|room)(?:\s|$)/.test(normalized);
}

export function extractRoomRenameRequest(prompt: string): { currentName: string; newName: string } | null {
  const match = prompt.match(/(?:renombra|cambia el nombre de|cambia de nombre)\s+(?:(?:la|el)\s+)?(?:estancia|habitación|habitacion|cuarto|espacio|zona)\s+(.+?)\s+(?:a|por)\s+(.+)$/i) ??
    prompt.match(/(?:rename|change name of)\s+(?:the\s+)?(?:room|area|space|zone)\s+(.+?)\s+to\s+(.+)$/i);
  if (!match) return null;

  const currentName = match[1].trim().replace(/[.?!]+$/, '').trim();
  const newName = match[2].trim().replace(/[.?!]+$/, '').trim();
  return currentName && newName ? { currentName, newName } : null;
}

export function extractRoomDeletionName(prompt: string): string | null {
  const match = prompt.match(/(?:elimina|eliminar|borra|borrar|quita|quitar)\s+(?:(?:la|el)\s+)?(?:estancia|habitación|habitacion|cuarto|espacio|zona)\s+(.+)$/i) ??
    prompt.match(/(?:delete|remove)\s+(?:the\s+)?(?:room|area|space|zone)\s+(.+)$/i);
  if (!match) return null;

  const name = match[1].trim().replace(/[.?!]+$/, '').trim();
  return name || null;
}
