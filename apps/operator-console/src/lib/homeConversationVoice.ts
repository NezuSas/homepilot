export function normalizeVoiceTranscript(transcript: string): string {
  return transcript
    .trim()
    .replace(/\ba\s+pagar\b/gi, 'apagar')
    .replace(/\ba\s+paga\b/gi, 'apaga')
    .replace(/\ba\s+pa\b/gi, 'apaga')
    .replace(/\bapage\b/gi, 'apaga')
    .replace(/\bla\s+luz\s+a\s+la\s+sala\b/gi, 'la luz de la sala')
    .replace(/\b(el|la)\s+luceje\b/gi, 'luces')
    .replace(/\bluceje\b/gi, 'luces')
    .replace(/\bluseje\b/gi, 'luces')
    .replace(/\bsentidas\b/gi, 'encendidas')
    .replace(/\bsendidas\b/gi, 'encendidas')
    .replace(/\bluces\s+esta\s+en\s+encendidas\b/gi, 'luces estan encendidas')
    .replace(/\bque\s+luces\s+esta\s+en\s+encendidas\b/gi, 'que luces estan encendidas')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isUsableVoiceTranscript(transcript: string): boolean {
  const normalized = normalizeWakeText(transcript);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return ['hola', 'hello', 'hi', 'hey', 'gracias', 'thanks', 'homepilot'].includes(normalized);
  }

  return [
    'apaga', 'apagar', 'enciende', 'encender', 'prende', 'prender',
    'abre', 'abrir', 'cierra', 'cerrar', 'luces', 'luz', 'estado',
    'encendidas', 'apagadas', 'escena', 'quien', 'ayuda', 'todo',
    'hola', 'gracias', 'dime', 'como', 'estas', 'tal', 'bien',
    'hora', 'fecha', 'dia', 'puedes', 'hacer', 'cuentame',
    'nombre', 'llamas', 'quien', 'eres', 'chiste', 'broma', 'homepilot', 'nezu'
  ].some(keyword => normalized.includes(keyword));
}

export function normalizeWakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractWakeCommand(transcript: string): { activated: boolean; command: string } {
  const normalized = normalizeWakeText(transcript);
  const wakePhrases = [
    'ok jompailot',
    'ok jom pailot',
    'ok hom pailot',
    'ok jon pailot',
    'oye homepilot',
    'oye jompailot',
    'oye jom pailot',
    'oye hom pailot',
    'ok homepilot',
    'ok home pilot',
    'hey homepilot',
    'hey jompailot',
    'hola homepilot',
    'hola jompailot',
    'jompailot',
    'jom pailot',
    'hom pailot',
    'jon pailot',
    'home pailot',
    'home pilot',
    'homepilot',
    'hom pilot',
    'jom pilot',
    'jon pilot',
    'on pilot',
    'om pilot'
  ];

  for (const phrase of wakePhrases) {
    const index = normalized.indexOf(phrase);
    if (index >= 0) {
      return {
        activated: true,
        command: normalized.slice(index + phrase.length).trim()
      };
    }
  }

  return { activated: false, command: '' };
}
