

// Pure predicates for state, sensor, listing and management prompts.

export function isStateQuery(normalized: string): boolean {
  const stateKeywords = [
    'encendido', 'encendidos', 'encendida', 'encendidas',
    'prendido', 'prendidos', 'on', 'active', 'enabled',
    'apagado', 'apagados', 'apagada', 'apagadas',
    'off', 'inactive', 'disabled'
  ];

  const hasState = stateKeywords.some(kw => containsWord(normalized, kw));

  const generalTriggers = [
    "que", "hay", "tengo", "luces", "dispositivos", "estado", "cuales", "donde", "quien", "cuanto", "son", "cuarto", "habitacion", "como",
    "esas", "esos", "esa", "eso",
    "what", "whats", "which", "status", "on", "off", "where", "those", "them"
  ];

  const isGeneral = generalTriggers.some(q => containsWord(normalized, q));


  const hasInventoryCount = isInventoryCountQuery(normalized);
  const isRoomStatus = normalized.includes('como esta la ') || normalized.includes('como esta el ');
  const isGeneralState = isGeneral && (
    hasState ||
    hasInventoryCount ||
    containsWord(normalized, "hay") ||
    containsWord(normalized, "estan") ||
    containsWord(normalized, "son") ||
    containsWord(normalized, "donde") ||
    containsWord(normalized, "cuarto") ||
    containsWord(normalized, "habitacion") ||
    containsWord(normalized, "estado") ||
    containsWord(normalized, "status") ||
    containsWord(normalized, "esas") ||
    containsWord(normalized, "esos") ||
    containsWord(normalized, "esa") ||
    containsWord(normalized, "eso") ||
    containsWord(normalized, "those") ||
    containsWord(normalized, "them") ||
    isRoomStatus
  );

  if (!isGeneralState) return false;

  // Safety: if it contains an action verb, it's probably NOT a state query (e.g. "enciende esa")
  const actionVerbs = ['prende', 'apaga', 'enciende', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'turn on', 'turn off', 'open', 'close'];
  const hasAction = actionVerbs.some(v => containsWord(normalized, v));

  return !hasAction;
}

export function isInventoryCountQuery(normalized: string): boolean {
  const inventoryTerms = ['luz', 'luces', 'dispositivo', 'dispositivos', 'light', 'lights', 'device', 'devices'];
  const countTerms = ['cuanto', 'cuantos', 'cuanta', 'cuantas'];

  return inventoryTerms.some((term) => containsWord(normalized, term)) && (
    countTerms.some((term) => containsWord(normalized, term)) ||
    normalized.includes('how many')
  );
}

export function isDetailFollowUp(normalized: string): boolean {
  const detailTriggers = [
    "dame detalle", "detalle", "ver detalle", "lista completa", "muestrame todo", "muéstrametodo",
    "show detail", "full list", "details", "more detail"
  ];
  return detailTriggers.includes(normalized);
}

export function isSensorReadingQuery(normalized: string): boolean {
  const metricTerms = ['temperatura', 'temperature', 'humedad', 'humidity'];
  if (metricTerms.some((term) => normalized.includes(term))) return true;

  const sensorTerms = ['sensor', 'lectura', 'reading'];
  const questionTerms = ['cual', 'cuál', 'cuanto', 'cuánto', 'valor', 'value', 'dime', 'tell me', 'what is', 'how much'];
  return sensorTerms.some((term) => normalized.includes(term))
    && questionTerms.some((term) => normalized.includes(term));
}

export function isPointStateQuery(normalized: string): boolean {
  // Si empieza por palabras interrogativas generales, delegar a State Query
  if (normalized.startsWith('que ') || normalized.startsWith('quien ') || normalized.startsWith('cuales ') || normalized.startsWith('cuáles ') || normalized.startsWith('what ') || normalized.startsWith('which ')) {
    return false;
  }

  const triggers = [
    'esta encendida', 'esta encendido', 'esta prendida', 'esta prendido', 'is on',
    'esta apagada', 'esta apagado', 'is off'
  ];
  return triggers.some(t => normalized.includes(t)) ||
         (normalized.startsWith('esta ') && (normalized.includes('prendid') || normalized.includes('encendid') || normalized.includes('apagad')));
}

export function isListScenesIntent(normalized: string): boolean {
  return normalized.includes('escenas') && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list') || normalized.includes('show'));
}

export function isListTimersIntent(normalized: string): boolean {
  const isTimerQuery = normalized.includes('temporizador') || normalized.includes('timer');
  const isListQuery = ['que', 'cuales', 'lista', 'muestra', 'show', 'list', 'what'].some((keyword) => normalized.includes(keyword));
  return isTimerQuery && isListQuery;
}

export function isListAutomationsIntent(normalized: string): boolean {
  return (normalized.includes('automatizaciones') || normalized.includes('rutinas') || normalized.includes('automations')) && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list'));
}

export function isManagementIntent(normalized: string): boolean {
  const managementKeywords = ['renombra', 'cambia', 'rename', 'change name', 'reschedule', 'activa', 'desactiva', 'cancela', 'cancel', 'pausa', 'resume', 'enable', 'disable', 'agrega', 'add', 'quita', 'remove', 'crea', 'create'];
  return managementKeywords.some(kw => normalized.includes(kw)) &&
         (normalized.includes('escena') || normalized.includes('automatizacion') || normalized.includes('rutina') || normalized.includes('scene') || normalized.includes('automation') || normalized.includes('routine') || normalized.includes('temporizador') || normalized.includes('timer') || normalized.includes('estancia') || normalized.includes('habitacion') || normalized.includes('cuarto') || normalized.includes('espacio') || normalized.includes('zona') || normalized.includes('room'));
}

export function containsWord(source: string, word: string): boolean {
  const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'i');
  return regex.test(source);
}
