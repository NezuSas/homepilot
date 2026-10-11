import { Device } from '../../../devices/domain/types';
import { validateDeviceCommand } from '../../../devices/domain/CommandCapabilityValidator';
import { DeviceCommandV1, isValidCommand } from '../../../devices/domain/commands';
import { normalizeText } from '../textMatching';
import { ScopeFilter } from '../ScopeFilter';

const scopeFilter = new ScopeFilter();

/**
 * Tablas de patrones y reglas de texto puras del parser de comandos múltiples:
 * normalización, inferencia de comando, categorías y control de dispositivos.
 */

export const VERB_PATTERN = /^(apaga|apagar|prende|prender|enciende|encender|activa|activar|desactiva|desactivar)\b/;
export const BULK_WORDS = new Set(['todo', 'todos', 'todas']);
const ARTICLE_WORDS = new Set(['los', 'las', 'el', 'la', 'de', 'del', 'un', 'una', 'unos', 'unas']);
export const LIGHT_SYNONYMS_REGEX = /\b(luz|luces|foco|focos|lampara|lamparas)\b/;
/** Splits an exclusion/exception clause into individual terms: "X, Y y Z" -> ["X","Y","Z"]. */
export const EXCEPTION_SPLIT_REGEX = /\s*,\s*|\s+(?:y|e)\s+/;
/**
 * "apaga CATEGORIA de/en (la zona|el area|la estancia|...)? NOMBRE" — generalizes the
 * deterministic room-bulk fast-path's fixed keyword list ("todo"/"todas las luces") to
 * an arbitrary category word (e.g. "dicroicos"), since new device categories appear per
 * household and can never be fully hardcoded in advance.
 */
export const ZONE_CATEGORY_REGEX = /^(apaga|apagar|prende|prender|enciende|encender|activa|activar|desactiva|desactivar)\s+(.+?)\s+(?:de|en)\s+(?:la\s+zona\s+|el\s+area\s+|la\s+estancia\s+|la\s+habitacion\s+|el\s+cuarto\s+|del\s+|de\s+la\s+|de\s+|la\s+|el\s+)?(.+)$/i;

/** Conectores que dividen oraciones de comandos. */
export const COMMAND_CONNECTORS = [' y ', ' tambien ', ' ademas ', ' pero ', ' and ', ' also ', ' but '];
export const EXCLUSION_WORDS = [' menos ', ' excepto ', ' salvo ', ' except ', ' except for ', ' minus '];

export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove accents
    .replace(/[¿?¡!.]/g, "")         // Remove punctuation (commas handled next — they delimit exclusion lists)
    .replace(/,/g, " , ")            // Isolate commas so they never stick to a word token
    .replace(/\s+/g, " ")            // Normalize spaces
    .trim();
}

export function stripArticlesAndBulkWords(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(t => t && !ARTICLE_WORDS.has(t) && !BULK_WORDS.has(t))
    .join(' ');
}

/** Strips the leading verb and returns the remaining bare category word(s). */
export function extractCategoryWord(basePartWithVerb: string): string {
  const rest = basePartWithVerb.replace(VERB_PATTERN, '').trim();
  const stripped = stripArticlesAndBulkWords(rest);
  if (!stripped) return rest.split(/\s+/).some(t => BULK_WORDS.has(t)) ? 'todo' : '';
  return stripped;
}

/**
 * Substring match with basic Spanish singular/plural tolerance (dicroico/dicroicos,
 * foco/focos) — the common case for a category word that doesn't exactly match a
 * device name's grammatical number.
 */
export function categoryMatchesDeviceName(category: string, deviceName: string): boolean {
  if (!category) return false;
  const name = normalizeText(deviceName);
  if (name.includes(category)) return true;
  const singular = category.endsWith('s') ? category.slice(0, -1) : null;
  if (singular && singular.length >= 3 && name.includes(singular)) return true;
  const plural = !category.endsWith('s') ? `${category}s` : null;
  if (plural && name.includes(plural)) return true;
  return false;
}

export function inferCommandFromSegment(segment: string): DeviceCommandV1 | null {
  const offKeywords = ['apaga', 'apagar', 'apagado', 'desactivar', 'off'];
  const onKeywords = ['prende', 'enciende', 'encender', 'encendido', 'activar', 'on'];

  const isOff = offKeywords.some(kw => {
    if (kw.length <= 3) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(segment);
    }
    return segment.includes(kw);
  });

  const isOn = onKeywords.some(kw => {
    if (kw.length <= 3) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(segment);
    }
    return segment.includes(kw);
  });

  if (isOff && !isOn) return 'turn_off';
  if (isOn && !isOff) return 'turn_on';

  return null;
}

export function isControllableDevice(device: Device, command: string): boolean {
  // Same availability and power-capability rules as every other path: a device still in the Inbox,
  // or a player that cannot be powered on or off (a PC agent), is never swept into a command.
  if (device.status !== 'ASSIGNED') return false;
  if (isValidCommand(command) && scopeFilter.lacksDeclaredPowerFeature(device, command)) return false;
  const rawState = device.lastKnownState;
  if (rawState && typeof rawState['state'] === 'string' && rawState['state'] === 'unavailable') return false;

  const type = device.type.toLowerCase();
  const name = device.name.toLowerCase();

  if (type === 'sensor' || type === 'binary_sensor') return false;
  if (name.includes('sensor') && !name.includes('luz') && !name.includes('foco')) return false;

  const TURN_TYPES = ['light', 'switch', 'outlet', 'dimmer'];
  if (TURN_TYPES.includes(type) && ['turn_on', 'turn_off', 'toggle'].includes(command)) return true;

  const controllableNames = ['luz', 'foco', 'lampara', 'interruptor', 'enchufe', 'tomacorriente', 'apagador'];
  if (controllableNames.some(kw => name.includes(kw))) return true;

  if (!isValidCommand(command)) return false;

  const validation = validateDeviceCommand(device, { name: command, params: {} });
  return validation.valid;
}
