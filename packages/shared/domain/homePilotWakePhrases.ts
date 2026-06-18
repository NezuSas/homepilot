const HOME_PILOT_WAKE_NAMES = [
  'homepilot',
  'home pilot',
  'home pylot',
  'home paylot',
  'pome pilote',
  'pome pilot',
  'jompailot',
  'jompilot',
  'jom pailot',
  'jom paylot',
  'hom pailot',
  'jon pailot',
  'jonpailot',
  'jonpilot',
  'home pailot',
  'hom pilot',
  'hompilot',
  'jom pilot',
  'jon pilot',
  'on pailot',
  'onpailot',
  'onpilot',
  'on pilot',
  'om pailot',
  'ompailot',
  'ompilot',
  'om pilot'
] as const;

const HOME_PILOT_WAKE_PREFIXES = ['ok', 'okay', 'okey', 'oye', 'hey', 'ei', 'hola'] as const;

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
