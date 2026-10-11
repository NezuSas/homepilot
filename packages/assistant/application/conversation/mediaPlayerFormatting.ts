import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';

// Pure formatting and state readers for media player status.

export function formatMediaPlayerStatus(
  players: readonly Device[],
  language: string,
  rooms: readonly Room[],
  requestedRoom?: Room
): string {
  const formattedPlayers = players.map((player) => formatSingleMediaPlayerStatus(player, language));
  const entries = formattedPlayers.map((entry) => `• ${entry}`).join('\n');
  if (requestedRoom) {
    return getAssistantResponseText('media.status_in_room', language, { roomName: requestedRoom.name, entries });
  }
  if (formattedPlayers.length === 1) return formattedPlayers[0];
  return getAssistantResponseText('media.status_list', language, { entries });
}

export function formatSingleMediaPlayerStatus(player: Device, language: string): string {
  if (isMediaPlayerUnavailable(player)) {
    return getAssistantResponseText('media.unavailable', language, { deviceName: player.name });
  }
  if (isMediaPlayerOff(player)) {
    return getAssistantResponseText('media.off', language, { deviceName: player.name });
  }

  const state = asAssistantStateRecord(player.lastKnownState);
  const attributes = asAssistantStateRecord(state.attributes);
  const title = firstAssistantText(state.media_title, attributes.media_title, state.title, attributes.title);
  const artist = firstAssistantText(state.media_artist, attributes.media_artist, state.media_album_artist, attributes.media_album_artist);
  const volume = readMediaPlayerVolume(player);
  const rawState = typeof state.state === 'string' ? state.state : '';

  if (rawState === 'playing') {
    return getAssistantResponseText('media.playing', language, { deviceName: player.name, title, artist, volume });
  }
  if (rawState === 'paused') {
    return getAssistantResponseText('media.paused', language, { deviceName: player.name, title, artist, volume });
  }
  return getAssistantResponseText('media.idle', language, { deviceName: player.name, volume });
}

export function isMediaPlayerUnavailable(player: Device): boolean {
  return player.lastKnownState?.state === 'unavailable';
}

export function isMediaPlayerOff(player: Device): boolean {
  return player.lastKnownState?.state === 'off' || player.lastKnownState?.on === false;
}

export function readMediaPlayerVolume(player: Device): number | null {
  const state = asAssistantStateRecord(player.lastKnownState);
  const attributes = asAssistantStateRecord(state.attributes);
  const rawVolume = state.volume_level ?? attributes.volume_level;
  return typeof rawVolume === 'number' && Number.isFinite(rawVolume)
    ? Math.round(rawVolume * 100)
    : null;
}

export function asAssistantStateRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function firstAssistantText(...values: unknown[]): string | null {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim() !== '');
  return typeof value === 'string' ? value.trim() : null;
}
