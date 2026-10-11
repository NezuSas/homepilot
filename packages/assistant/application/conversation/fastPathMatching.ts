import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';

// Pure matchers for deterministic fast-path commands.

export function extractTargetPhrase(prompt: string): string {
  const norm = normalizeAssistantPrompt(prompt);
  const verbs = ['prende', 'enciende', 'apaga', 'encender', 'apagar', 'activa', 'desactiva', 'abre', 'abrir', 'cierra', 'cerrar', 'turn on', 'turn off', 'open', 'close', 'toggle'];
  for (const v of verbs) {
    if (norm.startsWith(v + ' ')) return norm.substring(v.length + 1).trim();
    if (norm === v) return '';
  }
  return norm;
}

export function isRoomBulkFastPath(prompt: string): {
  command: 'turn_on' | 'turn_off';
  roomName: string;
  bulkType: 'all' | 'lights';
} | null {
  const normalized = prompt.toLowerCase();

  // Guard against multi-commands or exceptions which should be handled by V1 Intent Interpreter
  if (normalized.includes('menos') || normalized.includes('excepto') || normalized.includes('solo') || normalized.includes(' y ') || normalized.includes(' except ') || normalized.includes(' but ')) {
    return null;
  }

  // Standalone bulk words that must NOT be captured as a room name.
  // If the captured roomName matches one of these, no real room was specified.
  const esBulkOnlyWords = ['luces', 'todo', 'todas', 'dispositivos'];
  const enBulkOnlyWords = ['everything', 'all', 'all lights', 'all the lights', 'lights'];

  // Spanish Regex:
  // Group 1: Verb (enciende|prende|apaga|activa|desactiva)
  // Group 2: Bulk keyword — fixed set without embedded prepositions
  // Optional preposition cluster (en|el|del|de|la|las); state-qualified global light requests are rejected below.
  // Group 3: Room name (mandatory, at least one non-empty token after bulk keyword)
  const esRegex = /^(enciende|prende|apaga|activa|desactiva)\s+(todo|todas\s+las\s+luces|todas\s+las|todas|todo\s+el|todo\s+en|las\s+luces|luces)\s+(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)$/i;
  const esMatch = normalized.match(esRegex);
  if (esMatch) {
    const verb = esMatch[1].toLowerCase();
    const command = (verb === 'enciende' || verb === 'prende' || verb === 'activa') ? 'turn_on' : 'turn_off';
    const bulkKeyword = esMatch[2].toLowerCase().trim();
    const roomName = esMatch[3].trim();
    // Guard: if the captured room name is itself a bulk-only word, no room was actually given
    if (esBulkOnlyWords.includes(roomName) || /^(?:que\s+)?(?:esten|estan)\s+(?:encendidas?|prendidas?)$|^(?:encendidas?|prendidas?)$/.test(roomName)) return null;
    const bulkType = (bulkKeyword.includes('todo') || bulkKeyword === 'todas') ? 'all' : 'lights';
    return { command, roomName, bulkType };
  }

  // English Regex:
  // Group 1: Verb (turn|switch)
  // Group 2: Direction (on|off)
  // Group 3: Bulk keyword — fixed set
  // Optional preposition cluster (in|at|the|of the|of)
  // Group 4: Room name (mandatory)
  const enRegex = /^(turn|switch)\s+(on|off)\s+(everything|all\s+the\s+lights|all\s+lights|all|the\s+lights|lights)\s+(?:in\s+|at\s+|the\s+|of\s+the\s+|of\s+)?(.+)$/i;
  const enMatch = normalized.match(enRegex);
  if (enMatch) {
    const action = enMatch[2].toLowerCase();
    const command = action === 'on' ? 'turn_on' : 'turn_off';
    const bulkKeyword = enMatch[3].toLowerCase().trim();
    const roomName = enMatch[4].trim();
    // Guard: if the captured room name is itself a bulk-only word, no room was actually given
    if (enBulkOnlyWords.includes(roomName)) return null;
    const bulkType = (bulkKeyword === 'everything' || bulkKeyword === 'all') ? 'all' : 'lights';
    return { command, roomName, bulkType };
  }

  return null;
}

export function isSingularLightRequest(normalized: string): boolean {
  const singularNouns = [
    'la luz', 'el foco', 'la lampara', 'la bombilla', 'una luz', 'un foco',
    'the light', 'the bulb', 'the lamp', 'the spotlight', 'a light'
  ];
  return singularNouns.some(n => normalized.includes(n));
}

export function isRoomSingularLightFastPath(prompt: string): {
  command: 'turn_on' | 'turn_off';
  roomName: string;
} | null {
  const normalized = prompt.toLowerCase();

  // Exact singular noun tokens for Spanish — 'lux' is intentionally excluded (typo).
  // Regex uses word-boundary (\b) so partial matches like 'luxury' are rejected.
  const esRegex = /^(enciende|prende|apaga|activa|desactiva)\s+(?:la\s+|el\s+|una\s+|un\s+)?\b(luz|foco|lampara|bombilla)\b\s+(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)$/i;
  const esMatch = normalized.match(esRegex);
  if (esMatch) {
     const verb = esMatch[1].toLowerCase();
     const command = (verb === 'enciende' || verb === 'prende' || verb === 'activa') ? 'turn_on' : 'turn_off';
     const roomName = esMatch[3].trim();
     return { command, roomName };
  }

  // English: exact singular nouns only
  const enRegex = /^(turn|switch)\s+(on|off)\s+(?:the\s+|a\s+)?\b(light|bulb|lamp|spotlight)\b\s+(?:in\s+|at\s+|the\s+)?(.+)$/i;
  const enMatch = normalized.match(enRegex);
  if (enMatch) {
     const action = enMatch[2].toLowerCase();
     const command = action === 'on' ? 'turn_on' : 'turn_off';
     const roomName = enMatch[4].trim();
     return { command, roomName };
  }

  return null;
}

export function isRoomCoverFastPath(prompt: string): {
  command: 'open' | 'close';
  roomName: string;
} | null {
  const normalized = prompt.toLowerCase();
  const spanishMatch = /^(abre|cierra)\s+(?:la\s+|el\s+|las\s+|los\s+)?(?:cortina(?:s)?|persiana(?:s)?)\s+(?:en\s+|del\s+|de\s+la\s+|de\s+el\s+|de\s+|la\s+|el\s+)?(.+)$/iu.exec(normalized);
  if (spanishMatch) {
    return {
      command: spanishMatch[1].toLowerCase() === 'abre' ? 'open' : 'close',
      roomName: spanishMatch[2].trim()
    };
  }

  const englishMatch = /^(open|close)\s+(?:the\s+)?(?:curtain(?:s)?|blind(?:s)?|cover(?:s)?)\s+(?:in\s+|at\s+|of\s+the\s+)?(.+)$/iu.exec(normalized);
  if (englishMatch) {
    return {
      command: englishMatch[1].toLowerCase() === 'open' ? 'open' : 'close',
      roomName: englishMatch[2].trim()
    };
  }

  return null;
}

export function isBulkFastPath(normalized: string): { command: 'turn_on' | 'turn_off', bulkType: 'all' | 'lights' } | null {
  // Exclusion syntax must go through multi-command parser, not bulk fast-path.
  const exclusionWords = ['menos', 'excepto', 'salvo', 'except', 'minus'];
  if (exclusionWords.some(word => normalized.includes(word))) return null;

  const offVerbs = ['apaga', 'apagar', 'apagues', 'apaguen', 'desactiva', 'desactivar', 'desactives', 'desconecta', 'desconectar'];
  const onVerbs = ['prende', 'prender', 'prendas', 'enciende', 'encender', 'enciendas', 'activa', 'activar', 'actives'];
  const words = normalized.split(' ');
  const hasPassiveOffRequest = /^(apagado|apagada|apagados|apagadas)\s+(todo|todas? las luces)\b/.test(normalized)
    || /^(deja|dejes|dejar|mantiene|mantener)\s+.*\bapagadas?\b/.test(normalized);
  const hasPassiveOnRequest = /^(encendido|encendida|encendidos|encendidas)\s+(todo|todas? las luces)\b/.test(normalized)
    || /^(deja|dejes|dejar|mantiene|mantener)\s+.*\bencendidas?\b/.test(normalized);
  const hasOffCommand = offVerbs.some(verb => words.includes(verb)) || hasPassiveOffRequest || /\bturn off\b/.test(normalized);
  const hasOnCommand = onVerbs.some(verb => words.includes(verb)) || hasPassiveOnRequest || /\bturn on\b/.test(normalized);
  if (hasOffCommand === hasOnCommand) return null;

  const hasGlobalScope = /\b(todo|everything)\b|\btoda la casa\b|\bcasa (completa|entera)\b|\bhogar (completo|entero)\b|\bwhole house\b/.test(normalized);
  const targetsLights = /\b(luz|luces|iluminacion|lampara|lamparas|light|lights)\b/.test(normalized);
  const targetsAllLights = /\btodas? las luces\b|\blas luces que esten encendidas\b|\ball (the )?lights\b|\bthe lights that are on\b/.test(normalized);
  if (!hasGlobalScope && !targetsAllLights) return null;

  return {
    command: hasOffCommand ? 'turn_off' : 'turn_on',
    bulkType: targetsLights ? 'lights' : 'all'
  };
}

export function isVagueLightCommand(normalized: string, language: string): { command: DeviceCommandV1 } | null {
  const isEs = language === 'es';
  if (isEs) {
    if (normalized === 'prende la luz' || normalized === 'enciende la luz' || normalized === 'prende luces' || normalized === 'enciende luces') return { command: 'turn_on' };
    if (normalized === 'apaga la luz' || normalized === 'apaga luces') return { command: 'turn_off' };
  } else {
    if (normalized === 'turn on the light' || normalized === 'turn on lights') return { command: 'turn_on' };
    if (normalized === 'turn off the light' || normalized === 'turn off lights') return { command: 'turn_off' };
  }
  return null;
}
