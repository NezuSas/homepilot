import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

export type AssistantMediaPlayerResolution =
  | { type: 'not_applicable' }
  | { type: 'no_players' }
  | { type: 'clarification'; players: Device[] }
  | { type: 'missing_volume_amount'; player: Device }
  | { type: 'invalid_volume'; player: Device }
  | { type: 'status'; players: Device[] }
  | { type: 'command'; player: Device; command: DeviceCommandV1; params?: Record<string, unknown> };

/**
 * Parses the small, explicit vocabulary used to operate locally imported audio
 * players. It deliberately resolves only media_player devices and never
 * invents playback state or a streaming capability.
 */
export class AssistantMediaPlayerResolver {
  private readonly mediaKeywords = [
    'reproduciendo', 'reproducir', 'reproduce', 'reproductor', 'musica',
    'cancion', 'pista', 'sonando', 'suena', 'volumen', 'pausa', 'reanuda',
    'siguiente', 'anterior', 'audio', 'playing', 'playback', 'volume',
    'pause', 'resume', 'next track', 'previous track'
  ];

  public resolve(prompt: string, devices: readonly Device[], contextualPlayer?: Device): AssistantMediaPlayerResolution {
    const normalized = normalizeAssistantPrompt(prompt);
    const players = devices.filter((device) => device.type?.toLowerCase() === 'media_player');
    const contextualTarget = contextualPlayer && players.find((player) => player.id === contextualPlayer.id);
    if (contextualTarget && this.isContextualTurnOnPrompt(normalized)) {
      return { type: 'command', player: contextualTarget, command: 'turn_on' };
    }

    if (!this.isMediaPrompt(normalized)) return { type: 'not_applicable' };
    if (players.length === 0) return { type: 'no_players' };

    const command = this.resolveCommand(normalized);
    const namedPlayers = this.findNamedPlayers(normalized, players);
    const targets = namedPlayers.length > 0 ? namedPlayers : players;

    if (command?.kind === 'status') {
      return { type: 'status', players: targets };
    }

    if (!command) return { type: 'not_applicable' };
    if (targets.length !== 1) return { type: 'clarification', players: targets };

    const player = targets[0];
    if (command.kind === 'missing_volume_amount') return { type: 'missing_volume_amount', player };
    if (command.kind === 'invalid_volume') return { type: 'invalid_volume', player };

    if (command.kind === 'volume_relative') {
      const currentVolume = this.readVolume(player);
      if (currentVolume === null) return { type: 'missing_volume_amount', player };
      return {
        type: 'command',
        player,
        command: 'volume_set',
        params: { volume: Math.max(0, Math.min(100, currentVolume + command.delta)) }
      };
    }

    return {
      type: 'command',
      player,
      command: command.command,
      ...(command.volume === undefined ? {} : { params: { volume: command.volume } })
    };
  }

  private isMediaPrompt(prompt: string): boolean {
    return this.mediaKeywords.some((keyword) => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapedKeyword}\\b`).test(prompt);
    });
  }

  private isContextualTurnOnPrompt(prompt: string): boolean {
    return /\b(enciendelo|enciendela|prendelo|prendela|encenderlo|encenderla|usarlo|usarla|turn it on|use it)\b/.test(prompt);
  }

  private findNamedPlayers(prompt: string, players: Device[]): Device[] {
    const exactMatches = players.filter((player) => prompt.includes(normalizeAssistantPrompt(player.name)));
    if (exactMatches.length > 0) return exactMatches;

    const promptTokens = new Set(prompt.split(' ').filter((token) => token.length > 2));
    const overlapMatches = players.filter((player) => {
      const nameTokens = normalizeAssistantPrompt(player.name).split(' ').filter((token) => token.length > 2);
      return nameTokens.length > 0 && nameTokens.every((token) => promptTokens.has(token));
    });

    return overlapMatches;
  }

  private resolveCommand(prompt: string):
    | { kind: 'status' }
    | { kind: 'missing_volume_amount' }
    | { kind: 'invalid_volume' }
    | { kind: 'volume_relative'; delta: number }
    | { kind: 'command'; command: DeviceCommandV1; volume?: number }
    | null {
    if (/\b(que|cuales|cual)\b.*\b(reproductores?|dispositivos?)\b.*\b(audio|musica)\b|\b(reproductores?|dispositivos?)\b.*\b(audio|musica)\b.*\b(disponibles?|tengo|hay)\b/.test(prompt)) {
      return { kind: 'status' };
    }
    if (/(que|cual).*(reproduciendo|sonando|suena)|what.*playing|what is playing/.test(prompt)) {
      return { kind: 'status' };
    }

    const relativeMatch = /\b(sube|aumenta|incrementa|baja|reduce|disminuye|raise|increase|lower|decrease)\b.*\b(?:volumen|volume)\b.*\b(?:en|por|by)\s+(\d{1,3})\s*%?/.exec(prompt);
    if (relativeMatch) {
      const amount = Number(relativeMatch[2]);
      if (amount > 100) return { kind: 'invalid_volume' };
      const increases = ['sube', 'aumenta', 'incrementa', 'raise', 'increase'].includes(relativeMatch[1]);
      return { kind: 'volume_relative', delta: increases ? amount : -amount };
    }

    const absoluteMatch = /\b(?:pon|establece|ajusta|configura|set)\b.*\b(?:volumen|volume)\b.*\b(?:a|al|to)\s+(\d{1,3})\s*%?/.exec(prompt);
    if (absoluteMatch) {
      const volume = Number(absoluteMatch[1]);
      return volume <= 100
        ? { kind: 'command', command: 'volume_set', volume }
        : { kind: 'invalid_volume' };
    }

    if (/\b(sube|aumenta|incrementa|baja|reduce|disminuye|raise|increase|lower|decrease)\b.*\b(volumen|volume)\b/.test(prompt)) {
      return { kind: 'missing_volume_amount' };
    }

    if (/\b(pausa|pausar|pause)\b/.test(prompt)) return { kind: 'command', command: 'media_pause' };
    if (/\b(reanuda|reanudar|continua|continuar|resume)\b/.test(prompt)) return { kind: 'command', command: 'media_play' };
    if (/\b(siguiente|next track)\b/.test(prompt)) return { kind: 'command', command: 'media_next_track' };
    if (/\b(anterior|previous track)\b/.test(prompt)) return { kind: 'command', command: 'media_previous_track' };
    if (/\b(reproduce|reproducir|play)\b/.test(prompt)) return { kind: 'command', command: 'media_play' };

    return null;
  }

  private readVolume(player: Device): number | null {
    const state = this.asRecord(player.lastKnownState);
    const attributes = this.asRecord(state.attributes);
    const rawVolume = state.volume_level ?? attributes.volume_level;
    if (typeof rawVolume !== 'number' || !Number.isFinite(rawVolume)) return null;
    return Math.round(rawVolume * 100);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}
