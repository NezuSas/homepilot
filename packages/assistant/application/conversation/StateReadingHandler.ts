import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse } from './conversationTypes';
import { resolveRoomName } from './roomAliasResolution';
import { buildSensorReadingResponse } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Sensor readings, point-state queries and detail follow-ups. */
export class StateReadingHandler extends ConversationCollaborator {
  public async handleDetailFollowUp(memory: AssistantMemoryState, language: string, userId: string): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const rememberedIds = (memory.entities || []).map(e => e.id);
    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const filtered = devices.filter(d => rememberedIds.includes(d.id));

    if (filtered.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "I don't have the details for that anymore." : "Ya no tengo los detalles de esa consulta."
      };
    }

    const onDevices = filtered.filter(d => d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on'));
    const offDevices = filtered.filter(d => d.lastKnownState && (d.lastKnownState.on === false || d.lastKnownState.state === 'off'));

    const roomMap = await this.modules.session.buildRoomNameMap(filtered);

    let message = isEn ? "House detail:\n" : "Detalle de la casa:\n";

    if (onDevices.length > 0) {
      message += isEn ? "\nOn:\n" : "\nEncendidas:\n";
      for (const d of onDevices) {
        const rName = resolveRoomName(d.roomId, roomMap, language);
        message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
      }
    }

    if (offDevices.length > 0) {
      message += isEn ? "\nOff:\n" : "\nApagadas:\n";
      for (const d of offDevices) {
        const rName = resolveRoomName(d.roomId, roomMap, language);
        message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
      }
    }

    return {
      type: 'answer',
      message: message.trim()
    };
  }

  public async handleSensorReadingQuery(normalized: string, language: string, userId: string): Promise<AssistantConversationResponse> {
    const sensors = (await this.deps.permissionGate.getAuthorizedDevices(userId))
      .filter((device) => device.type === 'sensor' || device.type === 'binary_sensor');
    const metricTerms = ['temperatura', 'temperature', 'humedad', 'humidity'].filter((term) => normalized.includes(term));
    const matches = sensors.filter((device) => {
      const normalizedName = normalizeAssistantPrompt(device.name);
      const normalizedExternalId = normalizeAssistantPrompt(device.externalId);
      const explicitlyNamed = normalized.includes(normalizedName);
      const metricMatch = metricTerms.some((term) => normalizedName.includes(term) || normalizedExternalId.includes(term));
      return explicitlyNamed || metricMatch;
    });

    if (matches.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('sensor.not_found', language, {}) };
    }

    if (matches.length > 1) {
      const options = matches.map((device) => ({ id: device.id, label: device.name, kind: 'device' as const }));
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'sensor_reading',
        source: 'sensor_reading',
        entities: matches.map((device) => ({ id: device.id, name: device.name, type: device.type, roomId: device.roomId })),
        clarificationOptions: options,
        originalPrompt: normalized,
        timestamp: new Date().toISOString(),
      });
      return {
        type: 'clarification',
        message: getAssistantResponseText('sensor.clarification', language, {}),
        clarification: {
          question: getAssistantResponseText('sensor.clarification_question', language, {}),
          options,
          pendingAction: { originalPrompt: normalized },
        },
      };
    }

    return buildSensorReadingResponse(matches[0], language);
  }

  public async handleSensorReadingSelection(userId: string, sensorId: string, language: string): Promise<AssistantConversationResponse> {
    const sensor = (await this.deps.permissionGate.getAuthorizedDevices(userId))
      .find((device) => device.id === sensorId && (device.type === 'sensor' || device.type === 'binary_sensor'));
    if (!sensor) {
      return { type: 'answer', message: getAssistantResponseText('sensor.selection_unavailable', language, {}) };
    }

    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'sensor_reading',
      source: 'sensor_reading',
      entities: [{ id: sensor.id, name: sensor.name, type: sensor.type, roomId: sensor.roomId }],
      timestamp: new Date().toISOString(),
    });
    return buildSensorReadingResponse(sensor, language);
  }

  public async handlePointStateQuery(normalized: string, language: string, userId: string): Promise<AssistantConversationResponse> {
    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);

    // Buscar dispositivo en el prompt
    const matches = devices.filter(d => normalized.includes(normalizeAssistantPrompt(d.name)));

    if (matches.length === 0) {
      // Intentar buscar habitación
      const rooms = (await this.deps.permissionGate.getAuthorizedRooms(userId)) || [];
      const roomMatch = rooms.find(r => normalized.includes(normalizeAssistantPrompt(r.name)));

      if (roomMatch) {
        const roomDevices = devices.filter(d => d.roomId === roomMatch.id && this.deps.scopeFilter.isControllableDevice(d, 'turn_on'));
        if (roomDevices.length === 0) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_no_controllable', language, { roomName: roomMatch.name })
          };
        }

        const onDevices = roomDevices.filter(d => d.lastKnownState?.state === 'on');
        const total = roomDevices.length;

        if (onDevices.length === 0) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_all_off', language, { roomName: roomMatch.name })
          };
        } else if (onDevices.length === total) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_all_on', language, { roomName: roomMatch.name })
          };
        } else {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_summary', language, { onCount: onDevices.length, total, roomName: roomMatch.name })
          };
        }
      }

      return {
        type: 'answer',
        message: getAssistantResponseText('state.device_not_found', language, {})
      };
    }

    if (matches.length > 1) {
      const options = matches.map(d => ({ id: d.id, label: d.name, kind: 'device' as const }));
      return {
        type: 'clarification',
        message: getAssistantResponseText('state.device_multiple_matches', language, {}),
        clarification: { question: getAssistantResponseText('clarification.which_one', language, {}), options, pendingAction: { originalPrompt: normalized } }
      };
    }

    const device = matches[0];
    const state = device.lastKnownState?.state;
    const isAskingOn = normalized.includes('encendid') || normalized.includes('prendid') || normalized.includes('on');
    const isAskingOff = normalized.includes('apagad') || normalized.includes('off');

    const isOn = state === 'on' || (typeof state === 'number' && state > 0);

    let answer = '';
    if (isAskingOn) {
      answer = getAssistantResponseText('state.device_query_on', language, { deviceName: device.name, isOn });
    } else if (isAskingOff) {
      answer = getAssistantResponseText('state.device_query_off', language, { deviceName: device.name, isOff: !isOn });
    } else {
      answer = getAssistantResponseText('state.device_status', language, { deviceName: device.name, isOn });
    }

    return { type: 'answer', message: answer };
  }
}
