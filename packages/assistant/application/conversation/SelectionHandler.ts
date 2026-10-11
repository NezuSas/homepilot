import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { resolveSelectionFromMemory, inferCommandFromPrompt } from './confirmationReplies';
import { withJarvisStyle, buildCommandSuccessMessage } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Resolution of an option selected from a clarification. */
export class SelectionHandler extends ConversationCollaborator {
  public async handleSelection(request: AssistantConverseRequest, language: string): Promise<AssistantConversationResponse> {
    const userId = request.userId || 'system';
    const memory = await this.deps.memoryService.getShortTermMemory(userId);
    const correlationId = `assistant:chat:selection:${Date.now()}`;
    // selectedOptionId is set by UI clicks; pendingAction.targetId is set by natural-language text resolution.
    const rawTargetId = request.selectedOptionId === 'confirm'
      ? request.pendingAction?.targetId
      : (request.selectedOptionId ?? request.pendingAction?.targetId);

    if (!rawTargetId) {
      return { type: 'error', message: getAssistantResponseText('selection.target_required', language, {}) };
    }

    // Load memory to resolve from label if it looks like a label (Requirement B)
    let targetId = rawTargetId;

    if (memory?.clarificationOptions) {
      const resolvedId = resolveSelectionFromMemory(rawTargetId, memory.clarificationOptions, language);
      if (resolvedId) {
        targetId = resolvedId;
        const selectedOption = memory.clarificationOptions.find(opt => opt.id === targetId);

        // --- SAFETY GATE V2: ROOM SELECTION RESOLUTION ---
        if (selectedOption?.kind === 'room') {
          let command = request.pendingAction?.command;
          if (!command && memory.pendingIntent?.type === 'command') command = memory.pendingIntent.command;
          if (!command) command = inferCommandFromPrompt(memory.originalPrompt || request.prompt) as DeviceCommandV1 | undefined;

          if (command) {
            return await this.handleRoomSelectionForLight(targetId, command, userId, language, memory.originalPrompt || request.prompt, correlationId);
          }
        }
      }
    }

    // Check if it's a scene or device
    const scene = await this.deps.sceneRepository.findSceneById(targetId);
    if (scene?.userId === userId) {
      this.deps.learningService.recordClarificationSelected(userId, scene.id, scene.name, 'scene', request.pendingAction?.originalPrompt || '').catch(() => {});
      await this.deps.permissionGate.assertSceneAuthorized(userId, scene);
      const result = await this.deps.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });

      if (result.status === 'success') {
        await this.modules.session.clearPendingAction(userId);
        await this.deps.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities: scene.actions.map(a => ({ id: a.deviceId, name: 'device', type: 'device', roomId: null })),
          timestamp: new Date().toISOString()
        });
        console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ source: 'selection', sceneId: scene.id, sceneName: scene.name })}`);
      }

      return {
        type: 'execution',
        message: result.status === 'success'
          ? (language === 'en' ? `Executed scene ${scene.name}.` : `Ejecuté la escena ${scene.name}.`)
          : getAssistantResponseText('execution.failed', language, {}),
        execution: result
      };
    }

    let command = request.pendingAction?.command;
    if (!command && memory?.pendingIntent?.type === 'command') command = memory.pendingIntent.command;
    const originalPrompt = request.pendingAction?.originalPrompt || memory?.originalPrompt || '';

    // Fallback: reconstruct command from memory if missing (Requirement 6.2 & Selection resolution)
    if (!command) {
      command = inferCommandFromPrompt(originalPrompt) as DeviceCommandV1 | undefined;
    }

    if (!command) {
      const room = await this.deps.roomRepository.findRoomById(targetId);
      if (room) {
        return await this.modules.stateQueries.handleStateQuery(originalPrompt, language, request.userName || null, userId, undefined, targetId);
      }
    }

    if (command) {
      const device = await this.deps.deviceRepository.findDeviceById(targetId);
      const deviceName = device?.name ?? targetId;

      if (device) {
        this.deps.learningService.recordClarificationSelected(userId, device.id, device.name, 'device', originalPrompt).catch(() => {});
      }

      const result = await this.modules.commands.executeAuthorizedCommand(userId, targetId, command, originalPrompt, correlationId);

      if (result.status === 'success') {
        await this.modules.session.clearPendingAction(userId);
        await this.deps.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities: device ? [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }] : [],
          timestamp: new Date().toISOString()
        });

        if (device) {
          console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ source: 'selection', deviceId: device.id, deviceName: device.name })}`);
        }

        const logSource = request.selectedOptionId ? 'ui_option' : 'text_selection';
        console.info(`[ASSISTANT_SELECTION_EXECUTED] ${JSON.stringify({
          source: logSource,
          deviceId: targetId,
          deviceName,
          command
        })}`);
      }

      return await this.modules.session.attachSuggestionIfNeeded(withJarvisStyle({
        type: 'execution',
        message: result.status === 'success'
          ? buildCommandSuccessMessage(command, deviceName, request.userName || null, language)
          : getAssistantResponseText('execution.failed', language, {}),
        execution: result
      }, {
        status: result.status === 'success' ? 'success' : 'failed',
        action: command,
        target: deviceName,
        reason: result.actions[0]?.error,
        userName: request.userName?.trim() || undefined
      }, language), userId, language, memory, 'command');
    }

    return {
      type: 'error',
      message: getAssistantResponseText('selection.invalid', language, {})
    };
  }

  public async handleRoomSelectionForLight(roomId: string, command: DeviceCommandV1, userId: string, language: string, originalPrompt: string, correlationId: string): Promise<AssistantConversationResponse> {
    const room = await this.deps.roomRepository.findRoomById(roomId);
    const roomName = room?.name ?? roomId;

    // 1. Find controllable lights in that room
    const allDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const roomDevices = allDevices.filter(d => d.roomId === roomId);

    const roomLights = roomDevices.filter(d => this.deps.scopeFilter.isLightEntity(d) && this.deps.scopeFilter.isDeviceAvailable(d));

    // 2. Resolution Logic
    if (roomLights.length === 0) {
      console.info(`[ASSISTANT_ROOM_SELECTION_RESOLVED] ${JSON.stringify({ roomId, roomName, command, result: 'no_lights' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `I couldn't find any controllable lights in ${roomName}.`
          : `No encontré luces controlables en ${roomName}.`
      };
    }

    if (roomLights.length === 1) {
      const light = roomLights[0];
      console.info(`[ASSISTANT_ROOM_SELECTION_RESOLVED] ${JSON.stringify({ roomId, roomName, command, result: 'single_light', deviceId: light.id })}`);
      const result = await this.modules.commands.executeAuthorizedCommand(userId, light.id, command, originalPrompt, correlationId);

      await this.modules.session.clearPendingAction(userId);
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: light.id, name: light.name, type: light.type, roomId: light.roomId }],
        timestamp: new Date().toISOString()
      });

      return {
        type: 'execution',
        message: buildCommandSuccessMessage(command, light.name, null, language),
        execution: result
      };
    }

    // >1 lights: If no unique primary metadata exists, ask which one.
    // Name-based primary inference is no longer allowed.

    // Else: return device clarification options
    console.info(`[ASSISTANT_ROOM_SELECTION_RESOLVED] ${JSON.stringify({ roomId, roomName, command, result: 'clarification', count: roomLights.length })}`);
    const options = roomLights.map(l => ({
      id: l.id,
      label: l.name,
      kind: 'device' as const
    }));

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
        ? `I found ${roomLights.length} lights in ${roomName}. Which one do you mean?`
        : `Encontré ${roomLights.length} luces en ${roomName}. ¿A cuál te refieres?`,
      clarification: {
        question: getAssistantResponseText('clarification.which_one', language, {}),
        options
      }
    };
  }
}
