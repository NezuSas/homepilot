import { DateTime } from 'luxon';
import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse } from './conversationTypes';
import { inferCommandFromPrompt } from './confirmationReplies';
import { extractDraftName, extractRoutineTime, extractRoutineDays, getRoutineScheduleLabel, extractConditionalRoutineRequest, normalizeConditionalDeviceReference, extractRelativeTimerDelaySeconds } from './draftRequestParsing';
import { resolveRoomAlias } from './roomAliasResolution';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Draft, conditional routine and relative timer creation. */
export class DraftRequestHandler extends ConversationCollaborator {
  public async handleDraftCreation(
    normalized: string,
    language: string,
    userId: string = 'system',
    originalPrompt: string = normalized,
  ): Promise<AssistantConversationResponse> {
    try {
      const isScene = normalized.includes('escena') || normalized.includes('scene') || normalized.includes('modo') || normalized.includes('mode');
      const draftType = isScene ? 'scene' : 'routine';
      const requestedName = extractDraftName(originalPrompt, isScene);
      const inferredCandidate = inferCommandFromPrompt(normalized);
      const inferredCommand = inferredCandidate === 'turn_on' || inferredCandidate === 'turn_off' ? inferredCandidate : null;

      if (requestedName && !inferredCommand) {
        return { type: 'answer', message: getAssistantResponseText('draft.action_required', language, { draftType }) };
      }

      const routineTime = isScene ? null : extractRoutineTime(normalized);
      const routineDays = isScene ? undefined : extractRoutineDays(normalized);
      if (requestedName && !isScene && !routineTime) {
        return { type: 'answer', message: getAssistantResponseText('draft.time_required', language, {}) };
      }

      const [devices, allRooms] = await Promise.all([
        this.deps.permissionGate.getAuthorizedDevices(userId),
        this.deps.permissionGate.getAuthorizedRooms(userId),
      ]);

      let selectedRoom: Room | null = null;
      const aliases = await this.deps.memoryService.getAliases(userId);
      const resolution = resolveRoomAlias(normalized, allRooms, devices, userId, aliases);
      if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
        selectedRoom = resolution.rooms[0];
      }

      const command = inferredCommand || 'turn_off';
      if (!selectedRoom) {
        if (requestedName) {
          return { type: 'answer', message: getAssistantResponseText('draft.room_required', language, { draftType }) };
        }
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find the room specified. You can ask me "what rooms do you know".`
            : `No encontré la estancia especificada. Puedes preguntarme "qué estancias conoces".`,
        };
      }

      const roomDevices = devices.filter((device: Device) => device.roomId != null && device.roomId === selectedRoom.id);
      if (roomDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I found the room "${selectedRoom.name}", but no devices are assigned to it.`
            : `Encontré la estancia "${selectedRoom.name}", pero ningún dispositivo está asignado a ella.`,
        };
      }

      const controllableDevices = roomDevices.filter((device: Device) => this.deps.scopeFilter.isControllableDevice(device, command));
      if (controllableDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I found devices in "${selectedRoom.name}", but none of them are controllable (lights, switches, or outlets).`
            : `Encontré dispositivos en "${selectedRoom.name}", pero ninguno es controlable (luces, interruptores o enchufes).`,
        };
      }

      const draftName = requestedName ?? (language === 'en'
        ? `${command === 'turn_on' ? 'Turn on' : 'Turn off'} ${selectedRoom.name}`
        : `${command === 'turn_on' ? 'Encender' : 'Apagar'} ${selectedRoom.name}`);
      const fingerprint = `draft:${userId}:${normalized}:${selectedRoom.id}`;
      const homeId = selectedRoom.homeId || controllableDevices[0]?.homeId;

      if (!homeId) {
        return {
          type: 'answer',
          message: language === 'en'
            ? "I couldn't determine the home to create the draft."
            : 'No pude determinar el hogar para crear el borrador.',
        };
      }

      let draftId = '';
      if (isScene) {
        const actions = controllableDevices.map((device: Device) => ({
          deviceId: device.id,
          command: { name: command, params: {} },
        }));
        const draft = await this.deps.draftService.createSceneDraft(homeId, selectedRoom.id, draftName, actions, fingerprint);
        draftId = draft.id;
      } else {
        const timezone = await this.deps.systemVariableService.getSystemTimezone();
        const actions = controllableDevices.map((device: Device) => ({
          deviceId: device.id,
          command: { name: command, params: {} },
        }));
        const draft = await this.deps.draftService.createScheduledRoutineDraft(
          homeId,
          selectedRoom.id,
          draftName,
          { type: 'time', timeLocal: routineTime ?? '22:00', timezone, ...(routineDays ? { days: routineDays } : {}) },
          actions,
          fingerprint,
        );
        draftId = draft.id;
      }

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'draft_creation',
        entities: controllableDevices.map((device: Device) => ({ id: device.id, name: device.name, type: device.type, roomId: device.roomId })),
        timestamp: new Date().toISOString(),
        pendingDraft: {
          id: draftId,
          type: isScene ? 'scene' : 'automation',
          originalPrompt,
        },
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('draft.prepared', language, {
          draftType,
          name: draftName,
          command,
          count: controllableDevices.length,
          roomName: selectedRoom.name,
          time: isScene ? undefined : (routineTime ?? '22:00'),
          schedule: isScene ? undefined : getRoutineScheduleLabel(routineDays, language),
        }),
        clarification: {
          question: language === 'en' ? 'Do you want to activate it?' : '¿Quieres activarla?',
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes, activate' : 'Sí, activar', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No, cancel' : 'No, cancelar', kind: 'scene' },
          ],
        },
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AssistantConversation] Error in handleDraftCreation:', error);
      }
      return {
        type: 'answer',
        message: language === 'en'
          ? 'I couldn\'t prepare the scene draft. Make sure there are controllable devices in that room.'
          : 'No pude preparar el borrador de escena. Revisa que existan dispositivos en esa estancia.',
      };
    }
  }

  public async handleConditionalRoutineRequest(normalized: string, language: string, userId: string, originalPrompt: string): Promise<AssistantConversationResponse | null> {
    const request = extractConditionalRoutineRequest(normalized);
    if (!request) return null;

    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const sourceReference = normalizeConditionalDeviceReference(request.sourceName);
    const targetReference = normalizeConditionalDeviceReference(request.targetName);
    const sourceMatches = devices.filter((device) => normalizeAssistantPrompt(device.name) === sourceReference);
    const targetMatches = devices.filter((device) => normalizeAssistantPrompt(device.name) === targetReference);
    if (sourceMatches.length !== 1 || targetMatches.length !== 1) {
      return { type: 'answer', message: language === 'en' ? 'Use the exact names of one trigger device and one target device for that routine.' : 'Usa los nombres exactos de un dispositivo disparador y un dispositivo objetivo para esa rutina.' };
    }

    const source = sourceMatches[0];
    const target = targetMatches[0];
    if (source.id === target.id) {
      return { type: 'answer', message: language === 'en' ? 'The trigger device and target device must be different.' : 'El dispositivo disparador y el dispositivo objetivo deben ser distintos.' };
    }
    if (source.homeId !== target.homeId) {
      return { type: 'answer', message: language === 'en' ? 'Both devices must belong to the same home.' : 'Los dos dispositivos deben pertenecer al mismo hogar.' };
    }
    if (!this.deps.scopeFilter.isControllableDevice(target, request.command)) {
      return { type: 'answer', message: language === 'en' ? `I cannot ${request.command === 'turn_on' ? 'turn on' : 'turn off'} "${target.name}".` : `No puedo ${request.command === 'turn_on' ? 'encender' : 'apagar'} "${target.name}".` };
    }

    const actionLabel = language === 'en'
      ? `${request.command === 'turn_on' ? 'turn on' : 'turn off'} ${target.name}`
      : `${request.command === 'turn_on' ? 'encender' : 'apagar'} ${target.name}`;
    const name = language === 'en'
      ? `When ${source.name} turns ${request.expectedValue}, ${actionLabel}`
      : `Cuando ${source.name} se ${request.expectedValue === 'on' ? 'encienda' : 'apague'}, ${actionLabel}`;
    const draft = await this.deps.draftService.createAutomationDraft(
      source.homeId,
      name,
      { type: 'device_state_changed', deviceId: source.id, stateKey: 'state', expectedValue: request.expectedValue },
      { type: 'device_command', targetDeviceId: target.id, command: request.command },
      `conditional:${userId}:${source.id}:${request.expectedValue}:${target.id}:${request.command}`,
    );
    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'draft_creation',
      entities: [source, target].map((device) => ({ id: device.id, name: device.name, type: device.type, roomId: device.roomId })),
      timestamp: new Date().toISOString(),
      pendingDraft: { id: draft.id, type: 'automation', originalPrompt },
    });
    return {
      type: 'clarification',
      message: language === 'en' ? `I prepared the routine "${name}". Do you want to activate it?` : `Preparé la rutina "${name}". ¿Quieres activarla?`,
      clarification: {
        question: language === 'en' ? 'Do you want to activate it?' : '¿Quieres activarla?',
        options: [
          { id: 'confirm', label: language === 'en' ? 'Yes, activate' : 'Sí, activar', kind: 'scene' },
          { id: 'cancel', label: language === 'en' ? 'No, cancel' : 'No, cancelar', kind: 'scene' },
        ],
      },
    };
  }

  public async handleRelativeTimerRequest(normalized: string, language: string, userId: string, originalPrompt: string): Promise<AssistantConversationResponse | null> {
    const delaySeconds = extractRelativeTimerDelaySeconds(normalized);
    const inferred = inferCommandFromPrompt(normalized);
    const command = inferred === 'turn_on' || inferred === 'turn_off' ? inferred : null;
    if (!delaySeconds || !command) return null;

    const [devices, allRooms, aliases] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId),
      this.deps.memoryService.getAliases(userId),
    ]);
    const namedDevices = devices.filter((device) => normalized.includes(normalizeAssistantPrompt(device.name)));
    if (namedDevices.length > 1) {
      return { type: 'answer', message: language === 'en' ? 'I found more than one device matching that timer. Please use its full name.' : 'Encontré más de un dispositivo para ese temporizador. Indícame su nombre completo.' };
    }

    let selectedRoom: Room;
    let controllableDevices: Device[];
    let targetName: string;
    if (namedDevices.length === 1) {
      const device = namedDevices[0];
      const room = allRooms.find((candidate) => candidate.id === device.roomId);
      if (!room) {
        return { type: 'answer', message: language === 'en' ? `I found "${device.name}", but it must be assigned to a room before scheduling it.` : `Encontré "${device.name}", pero debe estar asignado a una estancia antes de programarlo.` };
      }
      if (!this.deps.scopeFilter.isControllableDevice(device, command)) {
        return { type: 'answer', message: language === 'en' ? `I cannot ${command === 'turn_on' ? 'turn on' : 'turn off'} "${device.name}".` : `No puedo ${command === 'turn_on' ? 'encender' : 'apagar'} "${device.name}".` };
      }
      selectedRoom = room;
      controllableDevices = [device];
      targetName = device.name;
    } else {
      const resolution = resolveRoomAlias(normalized, allRooms, devices, userId, aliases);
      if (resolution.status !== 'resolved' || resolution.rooms.length === 0) {
        return { type: 'answer', message: language === 'en' ? 'To create the timer, tell me which room or device it applies to.' : 'Para crear el temporizador, indícame la estancia o el dispositivo.' };
      }

      selectedRoom = resolution.rooms[0];
      controllableDevices = devices.filter((device: Device) => device.roomId === selectedRoom.id && this.deps.scopeFilter.isControllableDevice(device, command));
      if (controllableDevices.length === 0) {
        return { type: 'answer', message: language === 'en' ? `I found "${selectedRoom.name}", but it has no controllable lights, switches, or outlets.` : `Encontré "${selectedRoom.name}", pero no tiene luces, interruptores o enchufes controlables.` };
      }
      targetName = selectedRoom.name;
    }

    const homeId = selectedRoom.homeId || controllableDevices[0]?.homeId;
    if (!homeId) return { type: 'answer', message: language === 'en' ? "I couldn't determine the home for the timer." : 'No pude determinar el hogar para el temporizador.' };

    const timezone = await this.deps.systemVariableService.getSystemTimezone();
    const scheduledAt = DateTime.now().setZone(timezone).plus({ seconds: delaySeconds });
    const dateLocal = scheduledAt.toISODate();
    if (!scheduledAt.isValid || !dateLocal) return { type: 'error', message: language === 'en' ? 'I could not calculate the timer schedule.' : 'No pude calcular el horario del temporizador.' };

    const amount = delaySeconds % 3600 === 0 ? delaySeconds / 3600 : delaySeconds / 60;
    const isHour = delaySeconds % 3600 === 0;
    const scheduleLabel = language === 'en'
      ? `in ${amount} ${isHour ? (amount === 1 ? 'hour' : 'hours') : (amount === 1 ? 'minute' : 'minutes')}`
      : `en ${amount} ${isHour ? (amount === 1 ? 'hora' : 'horas') : (amount === 1 ? 'minuto' : 'minutos')}`;
    const draftName = language === 'en' ? `${command === 'turn_on' ? 'Turn on' : 'Turn off'} ${targetName} timer` : `Temporizador ${command === 'turn_on' ? 'encender' : 'apagar'} ${targetName}`;
    const actions = controllableDevices.map((device: Device) => ({ deviceId: device.id, command: { name: command, params: {} } }));
    const draft = await this.deps.draftService.createScheduledRoutineDraft(
      homeId, selectedRoom.id, draftName,
      { type: 'time', timeLocal: scheduledAt.toFormat('HH:mm'), timezone, dateLocal },
      actions, `timer:${userId}:${normalized}:${selectedRoom.id}`,
    );

    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'draft_creation',
      entities: controllableDevices.map((device: Device) => ({ id: device.id, name: device.name, type: device.type, roomId: device.roomId })),
      timestamp: new Date().toISOString(),
      pendingDraft: { id: draft.id, type: 'automation', originalPrompt },
    });
    return {
      type: 'clarification',
      message: getAssistantResponseText('timer.prepared', language, { name: draftName, command, count: controllableDevices.length, roomName: selectedRoom.name, time: scheduledAt.toFormat('HH:mm'), schedule: scheduleLabel }),
      clarification: {
        question: language === 'en' ? 'Do you want to activate it?' : '¿Quieres activarlo?',
        options: [
          { id: 'confirm', label: language === 'en' ? 'Yes, activate' : 'Sí, activar', kind: 'scene' },
          { id: 'cancel', label: language === 'en' ? 'No, cancel' : 'No, cancelar', kind: 'scene' },
        ],
      },
    };
  }
}
