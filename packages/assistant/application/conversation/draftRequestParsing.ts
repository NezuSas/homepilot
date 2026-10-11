import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';

// Pure parsing of routine, scene-draft and timer requests.

export function isDraftCreation(normalized: string): boolean {
  const triggers = [
    'crea una escena', 'crear escena', 'crea escena', 'crear una escena', 'crea un modo', 'crear modo', 'haz una escena', 'prepara una escena',
    'crea una rutina', 'crear rutina', 'crea rutina', 'crear una rutina', 'crea una automatizacion', 'crear automatizacion', 'haz una rutina',
    'create scene', 'create a scene', 'create routine', 'create a routine', 'make a scene', 'make a routine', 'prepare a scene',
  ];
  return triggers.some((trigger) => normalized.includes(trigger));
}

export function extractDraftName(prompt: string, isScene: boolean): string | null {
  const draftTerm = isScene
    ? '(?:escena|modo|scene|mode)'
    : '(?:rutina|automatizacion|automation|routine)';
  const match = new RegExp(`${draftTerm}\\s+(?:llamada|llamado|named|called)\\s+(.+?)(?=\\s+(?:en|para|a las|at|in|for|to)\\s+|$)`, 'i').exec(prompt);
  if (!match) return null;

  const name = match[1].trim().replace(/[.?!]+$/, '').trim();
  return name.length > 0 ? name : null;
}

export function extractRoutineTime(prompt: string): string | null {
  const match = /(?:a las|at)\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/i.exec(prompt);
  if (!match) return null;

  let hour = Number(match[1]);
  const period = match[3]?.replace(/\./g, '').replace(/\s/g, '').toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;

  return `${String(hour).padStart(2, '0')}:${match[2] ?? '00'}`;
}

export function extractRoutineDays(prompt: string): number[] | undefined {
  if (/(?:de lunes a viernes|entre semana|dias laborables|weekdays|on weekdays)/i.test(prompt)) {
    return [1, 2, 3, 4, 5];
  }

  if (/(?:todos los dias|cada dia|diariamente|every day|daily)/i.test(prompt)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  return undefined;
}

export function getRoutineScheduleLabel(days: number[] | undefined, language: string): string | undefined {
  if (!days) return undefined;
  if (days.length === 5 && days.every((day, index) => day === index + 1)) {
    return language === 'en' ? 'on weekdays' : 'de lunes a viernes';
  }
  if (days.length === 7 && days.every((day, index) => day === index)) {
    return language === 'en' ? 'every day' : 'todos los días';
  }
  return undefined;
}

export function extractConditionalRoutineRequest(normalized: string): { sourceName: string; expectedValue: 'on' | 'off'; targetName: string; command: 'turn_on' | 'turn_off' } | null {
  const spanish = /cuando\s+se\s+(encienda|apague)\s+(.+?),?\s+(?:enciende|apaga)\s+(.+)/i.exec(normalized);
  if (spanish) {
    return {
      expectedValue: spanish[1].toLowerCase() === 'encienda' ? 'on' : 'off',
      sourceName: spanish[2].trim(),
      command: normalized.includes(' apaga ') ? 'turn_off' : 'turn_on',
      targetName: spanish[3].trim(),
    };
  }
  const english = /when\s+(.+?)\s+turns\s+(on|off),?\s+turn\s+(on|off)\s+(.+)/i.exec(normalized);
  if (!english) return null;
  return {
    sourceName: english[1].trim(),
    expectedValue: english[2].toLowerCase() === 'on' ? 'on' : 'off',
    command: english[3].toLowerCase() === 'on' ? 'turn_on' : 'turn_off',
    targetName: english[4].trim(),
  };
}

export function normalizeConditionalDeviceReference(value: string): string {
  return normalizeAssistantPrompt(value).replace(/^(?:la|el|los|las|the)\s+/, '').trim();
}

export function extractRelativeTimerDelaySeconds(prompt: string): number | null {
  const naturalDelays: Array<readonly [RegExp, number]> = [
    [/(?:en|dentro de)\s+media\s+hora\b/i, 30 * 60],
    [/^media\s+hora\b/i, 30 * 60],
    [/\bin\s+(?:a\s+)?half\s+(?:an?\s+)?hour\b/i, 30 * 60],
    [/^(?:a\s+)?half\s+(?:an?\s+)?hour\b/i, 30 * 60],
    [/(?:en|dentro de)\s+una\s+hora\b/i, 60 * 60],
    [/^una\s+hora\b/i, 60 * 60],
    [/\bin\s+an?\s+hour\b/i, 60 * 60],
    [/^an?\s+hour\b/i, 60 * 60],
  ];
  const naturalDelay = naturalDelays.find(([pattern]) => pattern.test(prompt));
  if (naturalDelay) return naturalDelay[1];

  const match = /(?:^|(?:en|dentro de|in)\s+)(\d+)\s*(minutos?|mins?|minutes?|hours?|horas?|hrs?)/i.exec(prompt.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return /^(horas?|hours?|hrs?)$/.test(match[2].toLowerCase()) ? amount * 3600 : amount * 60;
}

export function formatTimerRemaining(remainingSeconds: number, language: string): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === 'en') {
    if (hours === 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  if (hours === 0) return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return `${hours} ${hours === 1 ? 'hora' : 'horas'} y ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}
