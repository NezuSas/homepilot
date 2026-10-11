import type { Intent } from '../ports/IntentInterpreterPort';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { withJarvisStyle, buildCommandSuccessMessage, formatMultiCommandSummary } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Executes confirmed command and multi-command intents. */
export class IntentCommandRunner extends ConversationCollaborator {
  public async executeCommandIntent(
    intent: Extract<Intent, { type: 'command' }>,
    request: AssistantConverseRequest,
    language: string,
    userId: string,
    userName: string | null,
    prompt: string,
    memory: AssistantMemoryState | null,
    correlationId: string
  ): Promise<AssistantConversationResponse> {
    const preview = await this.deps.confirmationPolicy.evaluate(intent, language, userId);
    if (preview.requiresConfirmation && !request.confirmed) {
      const device = await this.deps.deviceRepository.findDeviceById(intent.deviceId);
      const deviceName = device?.name ?? intent.deviceId;
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: device ? [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }] : [],
        timestamp: new Date().toISOString(),
        pendingIntent: { ...intent, timestamp: new Date().toISOString() },
        originalPrompt: prompt
      });
      return withJarvisStyle({
        type: 'clarification',
        message: getAssistantResponseText('confirmation.device_control', language, { deviceName })
      }, {
        status: 'security_blocked',
        reason: 'mass_action_requires_confirmation',
        target: deviceName,
        userName: userName || undefined
      }, language);
    }
    try {
      const device = await this.deps.deviceRepository.findDeviceById(intent.deviceId);
      const deviceName = device?.name ?? intent.deviceId;
      const result = await this.modules.commands.executeAuthorizedCommand(userId, intent.deviceId, intent.command, intent.prompt, correlationId, intent.params);

      if (result.status === 'failed') {
        this.deps.learningService.recordCommandResult(userId, intent.deviceId, false, result.actions[0]?.error || 'Unknown error').catch(() => {});
        return withJarvisStyle({
          type: 'error',
          message: result.actions[0]?.userMessage || result.actions[0]?.error || getAssistantResponseText('execution.failed', language, {}),
          execution: result
        }, {
          status: 'failed',
          target: deviceName,
          reason: result.actions[0]?.error === 'DEVICE_OFFLINE' ? 'device_offline' : result.actions[0]?.error,
          userName: userName || undefined
        }, language);
      }

      // Clear pending confirmation
      await this.modules.session.clearPendingAction(userId);

      // Record learning event
      if (device) {
        this.deps.learningService.recordDeviceUsed(userId, device, prompt).catch(() => {});
      }
      this.deps.learningService.recordCommandResult(userId, intent.deviceId, true).catch(() => {});

      // V2: Save to memory
      this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: intent.deviceId, name: deviceName, type: 'device', roomId: device?.roomId || null }],
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return await this.modules.session.attachSuggestionIfNeeded(withJarvisStyle({
        type: 'execution',
        message: buildCommandSuccessMessage(intent.command, deviceName, userName, language),
        execution: result
      }, {
        status: 'success',
        action: intent.command,
        target: deviceName,
        userName: userName || undefined
      }, language), userId, language, memory, 'command');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        type: 'error',
        message: errorMessage || getAssistantResponseText('execution.unknown_error', language, {})
      };
    }
  }

  public async executeMultiCommandIntent(
    intent: Extract<Intent, { type: 'multi_command' }>,
    request: AssistantConverseRequest,
    language: string,
    userId: string,
    userName: string | null,
    prompt: string,
    memory: AssistantMemoryState | null,
    correlationId: string
  ): Promise<AssistantConversationResponse> {
    const preview = await this.deps.confirmationPolicy.evaluate(intent, language, userId);
    if (preview.requiresConfirmation && !request.confirmed) {
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingIntent: { ...intent, timestamp: new Date().toISOString() },
        originalPrompt: prompt
      });
      const actionSummary = intent.actions.slice(0, 3).map(a => a.targetName ?? a.deviceId).join(', ');
      const confirmMsg = getAssistantResponseText('confirmation.multi_action', language, { count: intent.actions.length, actionSummary });
      return withJarvisStyle({
        type: 'clarification',
        message: confirmMsg,
        clarification: {
          question: getAssistantResponseText('confirmation.are_you_sure', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.multi_action_yes', language, {}), kind: 'device' as const },
            { id: 'cancel', label: getAssistantResponseText('confirmation.multi_action_no', language, {}), kind: 'device' as const }
          ]
        }
      }, {
        status: 'security_blocked',
        reason: 'mass_action_requires_confirmation',
        target: actionSummary,
        userName: userName || undefined
      }, language);
    }
    try {
      const results = [];
      const entities = [];

      for (const action of intent.actions) {
        const device = await this.deps.deviceRepository.findDeviceById(action.deviceId);
        const deviceName = device?.name ?? action.targetName ?? action.deviceId;
        const result = await this.modules.commands.executeAuthorizedCommand(userId, action.deviceId, action.command, intent.prompt, correlationId, action.params);
        results.push({ action, deviceName, result });
        if (device) {
          entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
        }
      }

      const failures = results.filter(r => r.result.status === 'failed');

      const message = formatMultiCommandSummary(results, language);

      await this.modules.session.clearPendingAction(userId);
      this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return await this.modules.session.attachSuggestionIfNeeded({
        type: 'execution',
        message,
        execution: {
          sceneId: 'multi_command',
          status: failures.length === 0 ? 'success' : (failures.length === results.length ? 'failed' : 'partial'),
          actions: results.flatMap(r => r.result.actions)
        }
      }, userId, language, memory, 'multi_command');

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        type: 'error',
        message: errorMessage || getAssistantResponseText('execution.unknown_error', language, {})
      };
    }
  }
}
