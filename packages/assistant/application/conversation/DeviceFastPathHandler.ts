import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Device } from '../../../devices/domain/types';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse } from './conversationTypes';
import { isVagueLightCommand } from './fastPathMatching';
import { withJarvisStyle, buildCommandSuccessMessage } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Device, alias, context-room and Planner V2 hybrid fast paths. */
export class DeviceFastPathHandler extends ConversationCollaborator {
  public async attemptDeviceAliasFastPathExecution(activePrompt: string, userId: string, language: string, aliases: Record<string, string>): Promise<AssistantConversationResponse | null> {
    const TURN_ON_VERBS = ['prende', 'prender', 'enciende', 'encender', 'activa', 'activar'];
    const TURN_OFF_VERBS = ['apaga', 'apagar', 'desactiva', 'desactivar'];
    const TOGGLE_VERBS = ['alterna', 'alternar', 'toggle'];

    const normPrompt = normalizeAssistantPrompt(activePrompt);
    let command: DeviceCommandV1 | null = null;
    let targetPhrase = normPrompt;

    for (const verb of TURN_ON_VERBS) {
      if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
        command = 'turn_on';
        targetPhrase = normPrompt.substring(verb.length).trim();
        break;
      }
    }
    if (!command) {
      for (const verb of TURN_OFF_VERBS) {
        if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
          command = 'turn_off';
          targetPhrase = normPrompt.substring(verb.length).trim();
          break;
        }
      }
    }
    if (!command) {
      for (const verb of TOGGLE_VERBS) {
        if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
          command = 'toggle';
          targetPhrase = normPrompt.substring(verb.length).trim();
          break;
        }
      }
    }

    if (!command || !targetPhrase) return null;

    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const normTarget = normalizeAssistantPrompt(targetPhrase);

    // Priority 1: Exact real device name wins over alias
    const exactDevice = devices.find(d => normalizeAssistantPrompt(d.name) === normTarget);
    if (exactDevice) {
      return null;
    }

    // Priority 2: User-defined device alias
    const deviceAliases: Record<string, string> = {};
    for (const [alias, targetId] of Object.entries(aliases)) {
      if (devices.some(d => d.id === targetId)) {
        deviceAliases[alias] = targetId;
      }
    }

    const match = this.deps.aliasManagementService.findBestAliasMatch(targetPhrase, deviceAliases);

    if (match.status === 'not_found') {
      return null;
    }

    if (match.status === 'ambiguous') {
      const list = match.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible aliases: ${list}. Which one do you want to use?`
          : `Encontré varios aliases posibles: ${list}. ¿Cuál quieres usar?`
      };
    }

    const targetDevice = devices.find(d => d.id === match.targetId);
    if (!targetDevice) {
      console.warn(`[ASSISTANT_DEVICE_ALIAS_INVALID] ${JSON.stringify({ targetId: match.targetId })}`);
      return null;
    }

    console.info(`[ASSISTANT_DEVICE_ALIAS_RESOLVED] ${JSON.stringify({ targetId: targetDevice.id, command })}`);
    const execResult = await this.modules.commands.executeAuthorizedCommand(userId, targetDevice.id, command, activePrompt, `alias-fastpath-${Date.now()}`);

    if (execResult.status === 'success') {
      await this.modules.session.clearPendingAction(userId);
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: targetDevice.id, name: targetDevice.name, type: targetDevice.type, roomId: targetDevice.roomId }],
        timestamp: new Date().toISOString()
      });

      return await this.modules.session.attachSuggestionIfNeeded({
        type: 'execution',
        message: language === 'en'
          ? `I've ${command === 'turn_on' ? 'turned on' : command === 'turn_off' ? 'turned off' : 'toggled'} ${match.alias}.`
          : `He ${command === 'turn_on' ? 'encendido' : command === 'turn_off' ? 'apagado' : 'alternado'} ${match.alias}.`,
        execution: execResult
      }, userId, language, null, 'command');
    }

    return null;
  }

  public async attemptFastPathExecution(activePrompt: string, userId: string, language: string, userName: string | null): Promise<AssistantConversationResponse | null> {
    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const result = this.deps.fastPathResolver.resolve(activePrompt, Array.from(devices));
    if (!result) return null;

    const device = devices.find((d) => d.id === result.deviceId);
    if (!device) return null;
    // A named player that cannot be powered gets an explanation instead of a failed call or silence.
    if (this.deps.scopeFilter.lacksDeclaredPowerFeature(device, result.command)) {
      return { type: 'answer', message: getAssistantResponseText('media.operation_not_supported', language, { deviceName: device.name, action: result.command }) };
    }
    if (!this.deps.scopeFilter.isControllableDevice(device, result.command, result.params)) return null;

    const execResult = await this.modules.commands.executeAuthorizedCommand(userId, result.deviceId, result.command, activePrompt, `fastpath-${Date.now()}`, result.params);

    if (execResult.status === 'success') {
      await this.modules.session.clearPendingAction(userId);
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }],
        timestamp: new Date().toISOString()
      });

      const isSpanish = language === 'es';
      let msg = '';
      if (result.command === 'turn_on') msg = isSpanish ? `Hecho, encendí ${device.name}.` : `Done, turned on ${device.name}.`;
      else if (result.command === 'turn_off') msg = isSpanish ? `Hecho, apagué ${device.name}.` : `Done, turned off ${device.name}.`;
      else if (result.command === 'open') msg = isSpanish ? `Hecho, abrí ${device.name}.` : `Done, opened ${device.name}.`;
      else if (result.command === 'close') msg = isSpanish ? `Hecho, cerré ${device.name}.` : `Done, closed ${device.name}.`;
      else msg = isSpanish ? `Hecho, alterné ${device.name}.` : `Done, toggled ${device.name}.`;

      return await this.modules.session.attachSuggestionIfNeeded(withJarvisStyle({
        type: 'execution',
        message: msg,
        execution: execResult
      }, {
        status: 'success',
        action: result.command,
        target: device.name,
        userName: userName || undefined
      }, language), userId, language, null, 'command');
    }

    return null;
  }

  public async attemptContextRoomFastPathExecution(
    prompt: string,
    sourceRoomId: string | undefined,
    userId: string,
    userName: string | null,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    if (!sourceRoomId) return null;

    const normalized = normalizeAssistantPrompt(prompt);
    const vagueMatch = isVagueLightCommand(normalized, language);
    if (!vagueMatch) return null;

    // 2. Explicit target guard (MANDATORY)
    const [rooms, devices] = await Promise.all([
      this.deps.permissionGate.getAuthorizedRooms(userId),
      this.deps.permissionGate.getAuthorizedDevices(userId)
    ]);

    // Ensure prompt does not contain explicit room names
    for (const room of rooms) {
      if (normalized.includes(normalizeAssistantPrompt(room.name))) return null;
    }
    // Ensure prompt does not contain explicit device names
    for (const device of devices) {
      if (normalized.includes(normalizeAssistantPrompt(device.name))) return null;
    }
    // Ensure prompt does not contain user-defined aliases
    for (const alias of Object.keys(aliases)) {
      if (normalized.includes(normalizeAssistantPrompt(alias))) return null;
    }

    // 3. Contextual Resolution
    const targetRoom = rooms.find(r => r.id === sourceRoomId);
    if (!targetRoom) return null;

    const roomDevices = devices.filter(d => d.roomId === sourceRoomId);
    const lights = roomDevices.filter(d => this.deps.scopeFilter.isLightEntity(d) && this.deps.scopeFilter.isDeviceAvailable(d));

    if (lights.length === 0) {
      return {
        type: 'answer',
        message: language === 'en' ? "I didn't find controllable lights in this room." : "No encontré luces controlables en esta estancia."
      };
    }

    let selectedLight: Device | null = null;

    if (lights.length === 1) {
      selectedLight = lights[0];
    }

    if (!selectedLight) {
      // Ambiguity: DO NOT guess, MUST return clarification
      const clarificationOptions = lights.map(l => ({ id: l.id, label: l.name, kind: 'device' as const }));

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'clarification',
        entities: lights.map(l => ({ id: l.id, name: l.name, type: l.type, roomId: l.roomId })),
        clarificationOptions,
        originalPrompt: prompt,
        source: 'context_room',
        timestamp: new Date().toISOString()
      });

      console.info(`[ASSISTANT_CONTEXT_ROOM_CLARIFICATION] ${JSON.stringify({
        sourceRoomId,
        count: lights.length,
        command: vagueMatch.command
      })}`);

      return {
        type: 'clarification',
        message: language === 'en'
          ? "I found multiple lights in this room. Which one do you want to control?"
          : "Encontré varias luces en esta estancia. ¿Cuál quieres controlar?",
        clarification: {
          question: getAssistantResponseText('clarification.which_one', language, {}),
          options: clarificationOptions,
          pendingAction: {
            command: vagueMatch.command,
            originalPrompt: prompt
          }
        }
      };
    }

    // 4. Execution
    const execResult = await this.modules.commands.executeAuthorizedCommand(userId, selectedLight.id, vagueMatch.command, prompt, `context-${Date.now()}`);

    if (execResult.status === 'success') {
      await this.modules.session.clearPendingAction(userId);
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: selectedLight.id, name: selectedLight.name, type: selectedLight.type, roomId: selectedLight.roomId }],
        timestamp: new Date().toISOString()
      });

      console.info(`[ASSISTANT_CONTEXT_ROOM_RESOLVED] ${JSON.stringify({
        sourceRoomId,
        roomName: targetRoom.name,
        deviceId: selectedLight.id,
        deviceName: selectedLight.name,
        command: vagueMatch.command,
        reason: 'single_light'
      })}`);

      const msg = buildCommandSuccessMessage(vagueMatch.command, selectedLight.name, userName, language);

      return {
        type: 'execution',
        message: msg,
        execution: execResult
      };
    }

    return null;
  }

}
