const HOME_PILOT_WAKE_NAMES = [
  'homepilot',
  'home pilot',
  'jompailot',
  'jom pailot',
  'hom pailot',
  'jon pailot',
  'home pailot',
  'hom pilot',
  'jom pilot',
  'jon pilot',
  'on pilot',
  'om pilot'
] as const;

const HOME_PILOT_WAKE_PREFIXES = ['ok', 'oye', 'hey', 'hola'] as const;

export const HOME_PILOT_WAKE_PHRASES: readonly string[] = [
  ...HOME_PILOT_WAKE_PREFIXES.flatMap(prefix =>
    HOME_PILOT_WAKE_NAMES.map(name => `${prefix} ${name}`)
  ),
  ...HOME_PILOT_WAKE_NAMES
].sort((left, right) => right.length - left.length);

export function normalizeHomePilotWakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractHomePilotWakeCommand(text: string): { activated: boolean; command: string } {
  const normalized = normalizeHomePilotWakeText(text);

  for (const phrase of HOME_PILOT_WAKE_PHRASES) {
    if (normalized === phrase) {
      return { activated: true, command: '' };
    }

    if (normalized.startsWith(`${phrase} `)) {
      return {
        activated: true,
        command: normalized.slice(phrase.length).trim()
      };
    }
  }

  return { activated: false, command: '' };
}
