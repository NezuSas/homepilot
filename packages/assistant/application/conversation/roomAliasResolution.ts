import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { RoomAliasResolution } from './conversationTypes';

// Pure room alias and room reference resolution.

/** Returns the display name for a roomId using the provided map. */
export function resolveRoomName(roomId: string | null, roomMap: Map<string, string>, language: string): string | null {
  if (roomId === null) return language === 'en' ? 'No room' : 'Sin estancia';
  const name = roomMap.get(roomId);
  if (!name) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AssistantConversation] roomId "${roomId}" not found in room map`);
    }
    return language === 'en' ? 'Room not found' : 'Estancia no encontrada';
  }
  return name;
}

export function resolveRoomReference(prompt: string, rooms: ReadonlyArray<Room>, devices: ReadonlyArray<Device>, userId: string, userAliases: Record<string, string>): RoomAliasResolution {
  const normalized = normalizeAssistantPrompt(prompt);
  const candidates = [normalized];
  const stateRoomMatch = /^(?:como esta|que tal|estado de)\s+(?:la\s+|el\s+)?(.+)$/iu.exec(normalized);
  if (stateRoomMatch?.[1]) candidates.push(stateRoomMatch[1].trim());

  for (const candidate of candidates) {
    const resolution = resolveRoomAlias(candidate, rooms, devices, userId, userAliases);
    if (resolution.status !== 'not_found') return resolution;
  }

  return { status: 'not_found', rooms: [] };
}

export function resolveRoomAlias(roomName: string, rooms: ReadonlyArray<Room>, devices: ReadonlyArray<Device>, userId: string, userAliases: Record<string, string>): RoomAliasResolution {
  const normPromptRoom = normalizeAssistantPrompt(roomName);
  const roomEntries = rooms.map(r => ({ room: r, norm: normalizeAssistantPrompt(r.name) }));

  // Priority 1: Exact Match (normalized equality)
  const exactMatches = roomEntries.filter(e => e.norm === normPromptRoom);
  if (exactMatches.length === 1) return { status: 'resolved', rooms: [exactMatches[0].room] };
  if (exactMatches.length > 1) {
    const candidates = exactMatches.map(e => e.room.name);
    console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'exact', candidateCount: candidates.length })}`);
    return { status: 'ambiguous', rooms: [], candidates };
  }

  // Priority 2: Fuzzy Match (includes both ways)
  const fuzzyMatches = roomEntries.filter(e => e.norm.includes(normPromptRoom) || normPromptRoom.includes(e.norm));
  if (fuzzyMatches.length === 1) return { status: 'resolved', rooms: [fuzzyMatches[0].room] };
  if (fuzzyMatches.length > 1) {
    const candidates = fuzzyMatches.map(e => e.room.name);
    console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'fuzzy', candidateCount: candidates.length })}`);
    return { status: 'ambiguous', rooms: [], candidates };
  }

  // Priority 3: User-defined alias (NEW)
  const normUserAliases = Object.entries(userAliases).map(([alias, targetId]) => ({
    norm: normalizeAssistantPrompt(alias),
    targetId
  }));

  const userAliasMatches = normUserAliases.filter(a =>
    normPromptRoom === a.norm || normPromptRoom.includes(a.norm)
  );

  if (userAliasMatches.length > 0) {
    // Find longest match
    let longestMatchLen = 0;
    userAliasMatches.forEach(m => { if (m.norm.length > longestMatchLen) longestMatchLen = m.norm.length; });

    const bestMatches = userAliasMatches.filter(m => m.norm.length === longestMatchLen);

    if (bestMatches.length === 1) {
      const targetId = bestMatches[0].targetId;
      const room = rooms.find(r => r.id === targetId);
      if (room) {
        console.info(`[ASSISTANT_USER_ALIAS_RESOLVED] ${JSON.stringify({ targetId })}`);
        return { status: 'resolved', rooms: [room] };
      } else {
        // If target is not a room, check if it's a device. If it's a device, we ignore it here (room context)
        // but if it's neither, we log invalid.
        const isDevice = devices.some(d => d.id === targetId);
        if (!isDevice) {
          console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, targetId, reason: 'entity_not_found' })}`);
        }
      }
    } else {
      const candidateNames = bestMatches.map(m => {
        const r = rooms.find(room => room.id === m.targetId);
        return r?.name || m.targetId;
      });
      console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'user_alias', candidateCount: candidateNames.length })}`);
      return { status: 'ambiguous', rooms: [], candidates: candidateNames };
    }
  }

  // Priority 4: (DELETED) Built-in aliases are no longer supported.
  // Use user-defined aliases or exact room names.

  return { status: 'not_found', rooms: [] };
}
