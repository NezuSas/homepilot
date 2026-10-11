import { Device } from '../../../devices/domain/types';
import { AssistantMemoryEntity } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse } from './conversationTypes';
import { isInventoryCountQuery } from './stateQueryIntents';
import { resolveRoomReference, resolveRoomName } from './roomAliasResolution';
import { formatStateDevicePreview } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** State queries over rooms and devices. */
export class StateQueryHandler extends ConversationCollaborator {
  public async handleStateQuery(
    normalized: string,
    language: string,
    userName: string | null,
    userId: string,
    entitiesFromMemory?: AssistantMemoryEntity[],
    sourceRoomId?: string | null
  ): Promise<AssistantConversationResponse> {
    let allDevices: readonly Device[];

    if (entitiesFromMemory && entitiesFromMemory.length > 0) {
      const ids = entitiesFromMemory.map(e => e.id);
      const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
      allDevices = devices.filter(d => ids.includes(d.id));
    } else {
      allDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    }

    if (!allDevices) {
      return {
        type: 'answer',
        message: getAssistantResponseText('state.detail_no_devices', language, {})
      };
    }

    // Resolve room map from repository
    // Priority: Rooms belonging to the homes of the devices being queried
    const roomMap = await this.modules.session.buildRoomNameMap(allDevices);

    // Fallback: If no rooms found via device homes, try global room list
    if (roomMap.size === 0) {
      const allRooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      for (const r of allRooms) roomMap.set(r.id, r.name);
    }

    const isLightsOnly = normalized.includes('luz') || normalized.includes('luces') || normalized.includes('light');

    // Detect keywords
    const onKeywords = ['encendido', 'encendidos', 'encendida', 'encendidas', 'prendido', 'prendidos', 'on', 'active', 'enabled'];
    const offKeywords = ['apagado', 'apagados', 'apagada', 'apagadas', 'off', 'inactive', 'disabled'];

    const isOnQuery = onKeywords.some(kw => normalized.includes(kw));
    const isOffQuery = offKeywords.some(kw => normalized.includes(kw));
    const isCompound = isOnQuery && isOffQuery;
    const hasNoExplicitState = !isOnQuery && !isOffQuery;

    // Detect target room from the resolved map + user aliases
    let targetRoomId: string | null = null;
    let targetRoomName: string | null = null;

    // We use the same resolution logic as in singular light path for consistency
    const userAliases = await this.deps.memoryService.getAliases(userId);
    const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);

    // We need to identify if there's a potential room mention in the prompt.
    // Since we don't have a static list, we'll look for room names or aliases in the prompt.
    const resolution = resolveRoomReference(normalized, rooms, allDevices, userId, userAliases);

    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      targetRoomId = resolution.rooms[0].id;
      targetRoomName = resolution.rooms[0].name;
    } else if (resolution.status === 'ambiguous') {
      // For state queries, if ambiguous, we can either return an answer or just treat as global.
      // But the requirement says: "If a phrase looks like it references a room but no room resolves, return: No encontré esa estancia."
      // Ambiguous is a form of "not resolved yet".
      return {
        type: 'answer',
        message: getAssistantResponseText('state.room_ambiguous', language, {})
      };
    }

    // Detect if the prompt seems to mention a room but it wasn't resolved.
    // This is tricky without a static list. A common pattern is "en [lugar]".
    // If we didn't resolve a room but the prompt has "en " followed by words...
    if (!targetRoomId && (normalized.includes(' en ') || normalized.includes(' de la ') || normalized.includes(' del '))) {
       // Heuristic: if we see a preposition but no room matched, it's likely an unknown room.
       // We exclude global terms like "casa", "hogar", "home".
       const isGlobal = normalized.includes('casa') || normalized.includes('hogar') || normalized.includes('home');
       if (!isGlobal) {
         return {
           type: 'answer',
           message: getAssistantResponseText('state.room_not_found', language, {})
         };
       }
    }

    // Filtering
    let filteredDevices = allDevices;
    if (!entitiesFromMemory || entitiesFromMemory.length === 0) {
      if (targetRoomId) {
        filteredDevices = allDevices.filter(d => d.roomId === targetRoomId);
      } else {
        if (sourceRoomId) {
          filteredDevices = allDevices.filter(d => d.roomId === sourceRoomId);
          targetRoomId = sourceRoomId;
          targetRoomName = roomMap.get(sourceRoomId) || null;
        } else if (
          !normalized.includes('estado') &&
          !normalized.includes('que') &&
          !normalized.includes('qué') &&
          !normalized.includes('todas') &&
          (normalized.includes(' la luz') || normalized.includes(' las luces')) &&
          !normalized.includes(' de ') &&
          !normalized.includes(' en ')
        ) {
          const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
          const options = rooms.map(r => ({ id: r.id, label: r.name, kind: 'room' as const }));

          await this.deps.memoryService.saveShortTermMemory(userId, {
            lastQueryType: 'clarification',
            entities: [],
            timestamp: new Date().toISOString(),
            clarificationOptions: options,
            originalPrompt: normalized
          });

          return {
            type: 'clarification',
            message: getAssistantResponseText('state.room_selection_required', language, {}),
            clarification: {
              question: getAssistantResponseText('state.room_selection_question', language, {}),
              options,
              pendingAction: { originalPrompt: normalized }
            }
          };
        }
      }

      if (isLightsOnly) {
        filteredDevices = filteredDevices.filter(d => this.deps.scopeFilter.isLightEntity(d));
      }
    }

    const targetEntityLabel = language === 'en'
      ? (isLightsOnly ? 'lights' : 'devices')
      : (isLightsOnly ? 'luces' : 'dispositivos');

    // If no devices match the query at all
    if (filteredDevices.length === 0) {
      if (targetRoomName) {
        return {
          type: 'answer',
          message: getAssistantResponseText('state.no_targets_in_room', language, { entityLabel: targetEntityLabel, roomName: targetRoomName })
        };
      }
      return {
        type: 'answer',
        message: getAssistantResponseText('state.no_matching_targets', language, {})
      };
    }

    // Split into explicit On/Off
    if (isInventoryCountQuery(normalized)) {
      const itemLabel = language === 'en'
        ? (isLightsOnly ? (filteredDevices.length === 1 ? 'light' : 'lights') : (filteredDevices.length === 1 ? 'device' : 'devices'))
        : (isLightsOnly ? (filteredDevices.length === 1 ? 'luz' : 'luces') : (filteredDevices.length === 1 ? 'dispositivo' : 'dispositivos'));
      const roomSuffix = targetRoomName
        ? (language === 'en' ? ` in ${targetRoomName}` : ` en ${targetRoomName}`)
        : '';

      return {
        type: 'answer',
        message: getAssistantResponseText('state.inventory_count', language, { count: filteredDevices.length, itemLabel, roomSuffix })
      };
    }

    const onDevices = filteredDevices.filter(d => d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on'));
    const offDevices = filteredDevices.filter(d => d.lastKnownState && (d.lastKnownState.on === false || d.lastKnownState.state === 'off'));

    const isBroadQuery = (norm: string): boolean => {
      const broadTriggers = [
        'estado de la casa',
        'estado',
        'qué hay encendido y apagado',
        'que hay encendido y apagado',
        'home status',
        'house status',
        'status'
      ];
      // Check for exact matches to avoid catching "estado de la luz cocina"
      return broadTriggers.some(t => norm === t);
    };

    if (isBroadQuery(normalized) && !entitiesFromMemory) {
      const activeRooms = [...new Set(onDevices.map(d => resolveRoomName(d.roomId, roomMap, language)).filter(Boolean))];
      const namePrefix = userName ? `${userName}, ` : '';
      let broadMsg = "";

      if (language === 'es') {
        broadMsg = `${namePrefix}Estado de la casa:\n`;
        broadMsg += `• Encendidas: ${onDevices.length} luces/dispositivos\n`;
        broadMsg += `• Apagadas: ${offDevices.length} luces/dispositivos\n`;
        if (activeRooms.length > 0) {
          broadMsg += `• Estancias con actividad: ${activeRooms.join(', ')}\n`;
        }
        broadMsg += `\nPuedes pedir: "dame detalle" para ver la lista completa.`;
      } else {
        broadMsg = `${namePrefix}Home status:\n`;
        broadMsg += `• On: ${onDevices.length} lights/devices\n`;
        broadMsg += `• Off: ${offDevices.length} lights/devices\n`;
        if (activeRooms.length > 0) {
          broadMsg += `• Active rooms: ${activeRooms.join(', ')}\n`;
        }
        broadMsg += `\nYou can say: "show detail" to see the full list.`;
      }

      // Still save memory for "dame detalle" follow-up
      this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'state_devices',
        entities: filteredDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          roomId: d.roomId,
          roomName: resolveRoomName(d.roomId, roomMap, language) ?? undefined
        })),
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return {
        type: 'answer',
        message: broadMsg
      };
    }

    let message = "";
    const namePrefix = userName ? `${userName}, ` : '';

    const areaPrefix = targetRoomName
      ? `${namePrefix}${targetRoomName}\n\n`
      : (language === 'en' ? `${namePrefix}home status:\n\n` : `${namePrefix}estado de la casa:\n\n`);

    message = areaPrefix;

    if (isCompound || hasNoExplicitState) {
      if (onDevices.length === 0 && offDevices.length === 0) {
        return {
          type: 'answer',
          message: getAssistantResponseText('state.no_matching_targets', language, {})
        };
      }

      if (targetRoomName) {
        const onSummary = formatStateDevicePreview(onDevices, language);
        const offSummary = formatStateDevicePreview(offDevices, language);
        message = language === 'en'
          ? `${namePrefix}${targetRoomName} is currently:\n• On (${onDevices.length}): ${onSummary}.\n• Off (${offDevices.length}): ${offSummary}.`
          : `${namePrefix}Así está ${targetRoomName} ahora:\n• Encendidos (${onDevices.length}): ${onSummary}.\n• Apagados (${offDevices.length}): ${offSummary}.`;
      } else {
        message = areaPrefix;
        message += language === 'en' ? "On:\n" : "Encendidas:\n";
        if (onDevices.length > 0) {
          for (const d of onDevices) {
            const rName = resolveRoomName(d.roomId, roomMap, language);
            message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
          }
        } else {
          message += language === 'en' ? "• None" : "• Ninguna";
        }

        message += "\n";
        message += language === 'en' ? "Off:\n" : "Apagadas:\n";
        if (offDevices.length > 0) {
          for (const d of offDevices) {
            const rName = resolveRoomName(d.roomId, roomMap, language);
            message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
          }
        } else {
          message += language === 'en' ? "• None" : "• Ninguna";
        }
      }
    } else if (isOnQuery) {
      if (onDevices.length === 0) {
        message = language === 'en'
          ? `No ${isLightsOnly ? 'lights' : 'devices'} are currently on${targetRoomName ? ' in ' + targetRoomName : ''}.`
          : `No hay ${isLightsOnly ? 'luces' : 'dispositivos'} encendidas${targetRoomName ? ' en ' + targetRoomName : ''} en este momento.`;
      } else {
        message = language === 'en'
          ? `${namePrefix}you have ${onDevices.length} ${isLightsOnly ? 'lights' : 'devices'} on${targetRoomName ? ' in ' + targetRoomName : ''}:\n`
          : `${namePrefix}tienes ${onDevices.length} ${isLightsOnly ? 'luces' : 'dispositivos'} encendidas${targetRoomName ? ' en ' + targetRoomName : ''}:\n`;
        message = message.charAt(0).toUpperCase() + message.slice(1);
        for (const d of onDevices) {
          const rName = resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
        }
      }
    } else {
      // Off query
      if (offDevices.length === 0) {
        message = language === 'en'
          ? `No ${isLightsOnly ? 'lights' : 'devices'} are currently off${targetRoomName ? ' in ' + targetRoomName : ''}.`
          : `No hay ${isLightsOnly ? 'luces' : 'dispositivos'} apagadas${targetRoomName ? ' en ' + targetRoomName : ''} en este momento.`;
      } else {
        message = language === 'en'
          ? `${namePrefix}you have ${offDevices.length} ${isLightsOnly ? 'lights' : 'devices'} off${targetRoomName ? ' in ' + targetRoomName : ''}:\n`
          : `${namePrefix}tienes ${offDevices.length} ${isLightsOnly ? 'luces' : 'dispositivos'} apagadas${targetRoomName ? ' en ' + targetRoomName : ''}:\n`;
        message = message.charAt(0).toUpperCase() + message.slice(1);
        for (const d of offDevices) {
          const rName = resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
        }
      }
    }

    // V2: Save state result to memory with roomName cached — avoids re-fetching on follow-ups
    if (filteredDevices && filteredDevices.length > 0) {
      this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'state_devices',
        entities: filteredDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          roomId: d.roomId,
          roomName: resolveRoomName(d.roomId, roomMap, language) ?? undefined
        })),
        timestamp: new Date().toISOString()
      }).catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[AssistantConversation] saveShortTermMemory (state) failed:', err instanceof Error ? err.message : String(err));
        }
      });
    }

    // V2: Room resolution — use cached roomName from memory or roomMap
    const isRoomQuery = normalized.includes('donde') || normalized.includes('dónde') || normalized.includes('where');
    if (isRoomQuery && entitiesFromMemory && entitiesFromMemory.length > 0) {
      let roomMessage = '';
      for (const d of filteredDevices) {
        // Prefer cached roomName from memory entity, fall back to map lookup
        const memEntity = entitiesFromMemory.find(e => e.id === d.id);
        const rName = memEntity?.roomName ?? resolveRoomName(d.roomId, roomMap, language);
        roomMessage += `${d.name} (${rName ?? (language === 'en' ? 'No room' : 'Sin estancia')})\n`;
      }
      return { type: 'answer', message: roomMessage.trim() };
    }

    return {
      type: 'answer',
      message: message.trim()
    };
  }
}
