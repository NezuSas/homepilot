import {
  extractNezuWakeCommand,
  normalizeNezuWakeText
} from '../../../../packages/shared/domain/nezuWakePhrases';

export const HOME_CONVERSATION_STOP_SPEECH_EVENT = 'homepilot:stop-home-conversation-speech';
export const HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT = 'homepilot:home-conversation-speech-activity';

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
  if (!/[a-z0-9]/.test(normalized)) return false;
  if (isSilenceVoiceCommand(normalized)) return true;

  if (tokens.length < 2) {
    return ['hola', 'hello', 'hi', 'hey', 'gracias', 'thanks', 'nezu', 'si', 'no'].includes(normalized);
  }

  const lowValueTranscripts = [
    'ok',
    'okay',
    'eh',
    'mmm',
    'ah'
  ];

  return !lowValueTranscripts.includes(normalized);
}

export function normalizeWakeText(text: string): string {
  return normalizeNezuWakeText(text);
}

export function isSilenceVoiceCommand(transcript: string): boolean {
  const normalized = normalizeWakeText(transcript);
  if (!normalized) return false;

  const exactCommands = new Set([
    'callate',
    'cayate',
    'callete',
    'silencio',
    'silenciate',
    'detente',
    'parate',
    'para',
    'basta',
    'stop',
    'shh',
    'shhh'
  ]);

  if (exactCommands.has(normalized)) return true;

  return [
    /\b(deja|deje)\s+de\s+(hablar|responder)\b/,
    /\b(para|pare)\s+(de\s+)?(hablar|responder)\b/,
    /\b(no\s+)?(sigas|continues|continue)\s+(hablando|respondiendo)\b/,
    /\b(be\s+quiet|shut\s+up|stop\s+talking)\b/
  ].some(pattern => pattern.test(normalized));
}

export function extractWakeCommand(transcript: string): { activated: boolean; command: string } {
  return extractNezuWakeCommand(transcript);
}
