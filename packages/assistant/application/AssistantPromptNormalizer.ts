import { extractNezuWakeCommand } from '../../shared/domain/nezuWakePhrases';

/** Normalización compartida de lenguaje natural para servicios del asistente. */
export function normalizeAssistantPrompt(prompt: string): string {
    let normalized = prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[¿?¡!.,]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")            // Normalize spaces
      .trim();

    // Fix common typos
    normalized = normalized
      .replace(/\bcomoe stas\b/g, "como estas")
      .replace(/\bcomo stas\b/g, "como estas")
      .replace(/\bcm estas\b/g, "como estas")
      .replace(/\bq tal\b/g, "que tal")
      .replace(/\bq\b/g, "que")
      .replace(/\bk tal\b/g, "que tal")
      .replace(/\bapagues\b/g, "apaga")
      .replace(/\benciendas\b/g, "enciende")
      .replace(/\bprendas\b/g, "prende")
      .replace(/\ba\s+pagar\b/g, "apagar")
      .replace(/\ba\s+paga\b/g, "apaga")
      .replace(/\ba\s+pa\b/g, "apaga")
      .replace(/\bpa\b/g, "para")
      .replace(/\bapage\b/g, "apaga")
      .replace(/\bla\s+luz\s+a\s+la\s+sala\b/g, "la luz de la sala")
      .replace(/\b(el|la)\s+luceje\b/g, "luces")
      .replace(/\bluceje\b/g, "luces")
      .replace(/\bluseje\b/g, "luces")
      .replace(/\bsentidas\b/g, "encendidas")
      .replace(/\bsendidas\b/g, "encendidas")
      .replace(/\bluces\s+esta\s+en\s+encendidas\b/g, "luces estan encendidas")
      .replace(/\bque\s+luces\s+esta\s+en\s+encendidas\b/g, "que luces estan encendidas")
      .replace(/\bensaila\b/g, "en sala")
      .replace(/\bensala\b/g, "en sala")
      .replace(/\bcierres\b/g, "cierra")
      .replace(/\babras\b/g, "abre");

    const wakeCommand = extractNezuWakeCommand(normalized);
    if (wakeCommand.activated) {
      normalized = wakeCommand.command;
    }

    // Strip conversational wrappers so intent matching works on the core request.
    const politePrefixes = [
      'oye ', 'ok ', 'homepilot ', 'home pilot ', 'jarvis ',
      'puedes ', 'puede ', 'podrias ', 'podria ', 'me puedes ', 'me podrias ',
      'me ayudas a ', 'me ayudas ', 'ayudame a ', 'ayudame ',
      'quiero que ', 'quisiera que ', 'necesito que ', 'haz que ', 'haz ',
      'por favor ', 'porfa ', 'porfis '
    ];

    let strippedPrefix = true;
    while (strippedPrefix) {
      strippedPrefix = false;
      for (const prefix of politePrefixes) {
        if (normalized.startsWith(prefix)) {
          normalized = normalized.slice(prefix.length).trim();
          strippedPrefix = true;
          break;
        }
      }
    }

    const politeSuffixes = [
      ' por favor', ' porfa', ' porfis', ' gracias'
    ];
    let strippedSuffix = true;
    while (strippedSuffix) {
      strippedSuffix = false;
      for (const suffix of politeSuffixes) {
        if (normalized.endsWith(suffix)) {
          normalized = normalized.slice(0, -suffix.length).trim();
          strippedSuffix = true;
          break;
        }
      }
    }

    return normalized;
  }

