import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { resolveRoomAlias } from './roomAliasResolution';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Room-qualified and global bulk fast paths. */
export class RoomFastPathHandler extends ConversationCollaborator {
  public async handleRoomCoverFastPath(
    userId: string,
    command: 'open' | 'close',
    roomName: string,
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>,
    userName: string | null,
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    const [devices, rooms] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId)
    ]);
    const resolution = resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);

    if (resolution.status === 'ambiguous') {
      return { type: 'answer', message: getAssistantResponseText('state.room_ambiguous', language, {}) };
    }
    if (resolution.status !== 'resolved' || resolution.rooms.length !== 1) {
      return null;
    }

    const room = resolution.rooms[0];
    const covers = devices.filter((device) =>
      device.roomId === room.id
      && ['cover', 'blind', 'curtain', 'shutter'].includes(device.type.toLowerCase())
      && this.deps.scopeFilter.isControllableDevice(device, command)
    );

    if (covers.length === 0) {
      return {
        type: 'answer',
        message: getAssistantResponseText('state.no_targets_in_room', language, {
          entityLabel: language === 'en' ? 'curtains' : 'cortinas',
          roomName: room.name
        })
      };
    }

    if (covers.length > 1) {
      const options = covers.map((device) => ({ id: device.id, label: device.name, kind: 'device' as const }));
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'clarification',
        entities: [],
        timestamp: new Date().toISOString(),
        clarificationOptions: options,
        originalPrompt,
        pendingIntent: {
          type: 'command',
          deviceId: '',
          command,
          prompt: originalPrompt,
          timestamp: new Date().toISOString()
        }
      });
      return {
        type: 'clarification',
        message: language === 'en'
          ? `I found multiple curtains in ${room.name}. Please choose one.`
          : `Encontré varias cortinas en ${room.name}. Elige cuál quieres controlar.`,
        clarification: {
          question: language === 'en' ? 'Which curtain do you want to control?' : '¿Cuál cortina quieres controlar?',
          options,
          pendingAction: { command, originalPrompt }
        }
      };
    }

    return await this.modules.hooks.executeIntent({
      type: 'command',
      deviceId: covers[0].id,
      command,
      prompt: originalPrompt
    }, request, language, userId, userName, originalPrompt, null);
  }

  public async handleRoomSingularLightFastPath(
    userId: string,
    command: 'turn_on' | 'turn_off',
    roomName: string,
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    const [devices, rooms] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId)
    ]);

    const resolution = resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);
    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      return await this.modules.selection.handleRoomSelectionForLight(resolution.rooms[0].id, command, userId, language, originalPrompt, `singular-${Date.now()}`);
    }

    return null;
  }

  public async handleRoomBulkFastPath(
    userId: string,
    command: 'turn_on' | 'turn_off',
    roomName: string,
    bulkType: 'all' | 'lights',
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>
  ): Promise<AssistantConversationResponse> {
    const [devices, rooms] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId)
    ]);

    console.info(`[ASSISTANT_USER_ALIAS_LOOKUP] ${JSON.stringify({ userId, aliasCount: Object.keys(userAliases).length, requestedRoomLength: roomName.length })}`);
    const resolution = resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);

    if (resolution.status === 'ambiguous') {
      const list = resolution.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible rooms: ${list}. Which one do you want to use?`
          : `Encontré varias estancias posibles: ${list}. ¿Cuál quieres usar?`
      };
    }

    if (resolution.status === 'not_found' || resolution.rooms.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "I didn't find that room."
          : "No encontré esa estancia."
      };
    }

    const matchingRooms = resolution.rooms;
    const targetRoomIds = matchingRooms.map(r => r.id);
    const displayRoomName = matchingRooms[0].name;

    const matchingDevices = devices.filter(d => {
      const isInRoom = d.roomId && targetRoomIds.includes(d.roomId);
      if (!isInRoom) return false;
      // Same "only devices that actually need the change" filter as the global
      // bulk fast-path, so "apaga todo en la sala" and "apaga todo" behave consistently.
      return this.deps.scopeFilter.isControllableForBulk(d, command, bulkType) && this.deps.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (matchingDevices.length === 0) {
      const deviceTerm = bulkType === 'lights'
        ? (language === 'en' ? 'lights' : 'luces')
        : (language === 'en' ? 'controllable devices' : 'dispositivos controlables');
      return {
        type: 'answer',
        message: language === 'en'
          ? `I didn't find any ${deviceTerm} in ${displayRoomName}.`
          : `No encontré ${deviceTerm} en ${displayRoomName}.`
      };
    }

    return this.modules.commands.executeBulkDevices(userId, language, matchingDevices, command, originalPrompt, bulkType);
  }

  public async handleBulkFastPath(normalized: string, bulkType: 'all' | 'lights', command: 'turn_on' | 'turn_off', language: string, userId: string): Promise<AssistantConversationResponse | null> {
    const allDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);

    const targetDevices = allDevices.filter(d => {
      return this.deps.scopeFilter.isControllableForBulk(d, command, bulkType) && this.deps.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (targetDevices.length === 0) {
      const deviceTerm = bulkType === 'lights'
        ? (language === 'en' ? 'lights' : 'luces')
        : (language === 'en' ? 'controllable devices' : 'dispositivos controlables');
      return {
        type: 'answer',
        message: language === 'en'
          ? `I didn't find any ${deviceTerm}.`
          : `No encontré ${deviceTerm}.`
      };
    }

    return this.modules.commands.executeBulkDevices(userId, language, targetDevices, command, normalized, bulkType);
  }
}
