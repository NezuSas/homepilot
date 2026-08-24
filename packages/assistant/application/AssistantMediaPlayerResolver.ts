import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { Room } from '../../topology/domain/types';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

export type AssistantMediaPlayerResolution =
  | { type: 'not_applicable' }
  | { type: 'no_players' }
  | { type: 'no_players_in_room'; room: Room }
  | { type: 'clarification'; players: Device[] }
  | { type: 'missing_volume_amount'; player: Device }
  | { type: 'invalid_volume'; player: Device }
  | { type: 'status'; players: Device[]; room?: Room }
  | { type: 'command'; player: Device; command: DeviceCommandV1; params?: Record<string, unknown> };

type MediaCommand =
  | { kind: 'status' }
  | { kind: 'missing_volume_amount' }
  | { kind: 'invalid_volume' }
  | { kind: 'volume_relative'; delta: number }
  | { kind: 'command'; command: DeviceCommandV1; volume?: number };

/**
 * Resolves a deliberately bounded vocabulary for locally imported media players.
 * It only uses the caller-provided, authorized HomePilot inventory and never
 * discovers or controls an entity directly from Home Assistant.
 */
export class AssistantMediaPlayerResolver {
  private readonly mediaKeywords = [
    'reproduciendo', 'reproducir', 'reproduce', 'reproductor', 'reproductores',
    'musica', 'musical', 'cancion', 'canciones', 'pista', 'sonando', 'suena',
    'volumen', 'pausa', 'reanuda', 'siguiente', 'anterior', 'audio', 'audios',
    'parlante', 'parlantes', 'altavoz', 'altavoces', 'sonido', 'televisor', 'tv',
    'pantalla', 'pantallas', 'escuchar', 'playing', 'playback', 'volume', 'pause',
    'resume', 'next track', 'previous track', 'speaker', 'speakers', 'sound', 'listen'
  ];

  public resolve(
    prompt: string,
    devices: readonly Device[],
    contextualPlayer?: Device,
    rooms: readonly Room[] = []
  ): AssistantMediaPlayerResolution {
    const normalized = normalizeAssistantPrompt(prompt);
    const players = devices.filter((device) => device.type?.toLowerCase() === 'media_player');
    const contextualTarget = contextualPlayer && players.find((player) => player.id === contextualPlayer.id);
    const contextualCommand = contextualTarget ? this.resolveContextualCommand(normalized) : null;
    if (contextualTarget && contextualCommand) return this.toResolution(contextualTarget, contextualCommand);

    if (!this.isMediaPrompt(normalized)) return { type: 'not_applicable' };
    if (players.length === 0) return { type: 'no_players' };

    const command = this.resolveCommand(normalized);
    const namedPlayers = this.findNamedPlayers(normalized, players);
    const room = namedPlayers.length === 0 ? this.findNamedRoom(normalized, rooms) : undefined;
    const targets = namedPlayers.length > 0
      ? namedPlayers
      : room
        ? players.filter((player) => player.roomId === room.id)
        : players;

    if (command?.kind === 'status') {
      return targets.length === 0 && room
        ? { type: 'no_players_in_room', room }
        : { type: 'status', players: targets, ...(room ? { room } : {}) };
    }

    if (!command) return { type: 'not_applicable' };
    if (targets.length === 0 && room) return { type: 'no_players_in_room', room };
    if (targets.length !== 1) return { type: 'clarification', players: targets };
    return this.toResolution(targets[0], command);
  }

  private toResolution(player: Device, command: Exclude<MediaCommand, { kind: 'status' }>): AssistantMediaPlayerResolution {
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

  private resolveContextualCommand(prompt: string): Exclude<MediaCommand, { kind: 'status' }> | null {
    if (/\b(enciendelo|enciendela|prendelo|prendela|encenderlo|encenderla|usarlo|usarla|turn it on|use it)\b/.test(prompt)) {
      return { kind: 'command', command: 'turn_on' };
    }
    if (/\b(apagalo|apagala|apagarlo|apagarla|turn it off)\b/.test(prompt)) {
      return { kind: 'command', command: 'turn_off' };
    }
    if (/\b(pausalo|pausala|pausarlo|pausarla)\b/.test(prompt)) {
      return { kind: 'command', command: 'media_pause' };
    }
    if (/\b(reanudalo|reanudala|continualo|continuala)\b/.test(prompt)) {
      return { kind: 'command', command: 'media_play' };
    }
    return null;
  }

  private findNamedRoom(prompt: string, rooms: readonly Room[]): Room | undefined {
    return rooms.find((room) => {
      const roomName = normalizeAssistantPrompt(room.name);
      return roomName.length > 0 && new RegExp(`\\b${this.escapeRegularExpression(roomName)}\\b`).test(prompt);
    });
  }

  private findNamedPlayers(prompt: string, players: Device[]): Device[] {
    const exactMatches = players.filter((player) => prompt.includes(normalizeAssistantPrompt(player.name)));
    if (exactMatches.length > 0) return exactMatches;

    const promptTokens = new Set(prompt.split(' ').filter((token) => token.length > 2));
    return players.filter((player) => {
      const nameTokens = normalizeAssistantPrompt(player.name).split(' ').filter((token) => token.length > 2);
      return nameTokens.length > 0 && nameTokens.every((token) => promptTokens.has(token));
    });
  }

  private resolveCommand(prompt: string): MediaCommand | null {
    if (this.isMediaInventoryQuery(prompt) || /(que|cual).*(reproduciendo|sonando|suena)|what.*playing|what is playing/.test(prompt)) {
      return { kind: 'status' };
    }

    if (/\b(silencia|silenciar|mute)\b/.test(prompt)) return { kind: 'command', command: 'volume_set', volume: 0 };

    const relativeMatch = /\b(sube|subele|aumenta|incrementa|baja|bajale|reduce|disminuye|raise|increase|lower|decrease)\b(?:(?:.*?\b(?:en|por|unos|como|by)\s+)|\s+)(\d{1,3})\s*(?:%|por ciento|puntos?)?/.exec(prompt);
    if (relativeMatch && /\b(volumen|volume|sube|subele|aumenta|incrementa|baja|bajale|reduce|disminuye|raise|increase|lower|decrease)\b/.test(prompt)) {
      const amount = Number(relativeMatch[2]);
      if (amount > 100) return { kind: 'invalid_volume' };
      const increases = ['sube', 'subele', 'aumenta', 'incrementa', 'raise', 'increase'].includes(relativeMatch[1]);
      return { kind: 'volume_relative', delta: increases ? amount : -amount };
    }

    const absoluteMatch = /\b(?:pon|deja|fija|establece|ajusta|configura|cambia|set)\b.*?\b(?:volumen|volume)\b.*?\b(?:a|al|en|to)\s+(\d{1,3})\s*(?:%|por ciento)?/.exec(prompt);
    if (absoluteMatch) {
      const volume = Number(absoluteMatch[1]);
      return volume <= 100
        ? { kind: 'command', command: 'volume_set', volume }
        : { kind: 'invalid_volume' };
    }

    if (/\b(sube|subele|aumenta|incrementa|baja|bajale|reduce|disminuye|raise|increase|lower|decrease)\b.*\b(volumen|volume)\b|\b(subele|bajale)\b/.test(prompt)) {
      return { kind: 'missing_volume_amount' };
    }

    if (/\b(enciende|encender|prende|prender|turn on|switch on)\b/.test(prompt)) return { kind: 'command', command: 'turn_on' };
    if (/\b(apaga|apagar|turn off|switch off)\b/.test(prompt)) return { kind: 'command', command: 'turn_off' };
    if (/\b(pausa|pausar|pause)\b/.test(prompt)) return { kind: 'command', command: 'media_pause' };
    if (/\b(reanuda|reanudar|continua|continuar|resume)\b/.test(prompt)) return { kind: 'command', command: 'media_play' };
    if (/\b(siguiente|next track)\b/.test(prompt)) return { kind: 'command', command: 'media_next_track' };
    if (/\b(anterior|previous track)\b/.test(prompt)) return { kind: 'command', command: 'media_previous_track' };
    if (/\b(reproduce|reproducir|play)\b/.test(prompt)) return { kind: 'command', command: 'media_play' };

    return null;
  }

  private isMediaInventoryQuery(prompt: string): boolean {
    return /\b(que|cuales|cual|dime|muestrame|lista)\b.*\b(reproductores?|dispositivos?|parlantes?|altavoces?|audios?|equipos?|televisores?|tv|pantallas?)\b|\b(reproductores?|dispositivos?|parlantes?|altavoces?|audios?|equipos?|televisores?|tv|pantallas?)\b.*\b(tengo|hay|disponibles?)\b/.test(prompt);
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

  private escapeRegularExpression(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
