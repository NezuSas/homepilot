import { DeviceCommandV1, isValidCommand } from '../../../devices/domain/commands';
import type { Intent } from '../ports/IntentInterpreterPort';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Explain and retry flows driven by execution history. */
export class ExecutionHistoryHandler extends ConversationCollaborator {
  public async handleExplainQuery(targetId?: string, language: string = 'es'): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const recent = await this.deps.executionRecordRepository.findRecent(1);

    if (recent.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "I don't have a recent execution to analyze." : "No tengo una ejecución reciente para analizar."
      };
    }

    const record = recent[0];
    let relevantActions = record.actions;

    if (targetId) {
      relevantActions = record.actions.filter(a => a.deviceId === targetId);
    }

    const failures = relevantActions.filter(a => a.status === 'failed');

    if (failures.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "The last action does not show any failures." : "La última acción no registra fallos."
      };
    }

    // Build explanation from first failure
    const firstFail = failures[0];
    const device = await this.deps.deviceRepository.findDeviceById(firstFail.deviceId);
    const deviceName = device?.name ?? firstFail.deviceId;

    let message = isEn
      ? `The action on ${deviceName} failed.`
      : `La acción en ${deviceName} falló.`;

    if (firstFail.userMessage) {
      message = firstFail.userMessage;
    } else if (firstFail.error) {
      message = isEn ? `Error: ${firstFail.error}` : `Error: ${firstFail.error}`;
    }

    if (firstFail.suggestedAction) {
      message += isEn ? ` ${firstFail.suggestedAction}` : ` ${firstFail.suggestedAction}`;
    }

    // Add device context if available
    if (device) {
      const source = device.integrationSource;
      const state = device.lastKnownState;
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantExplain] Device: ${deviceName}, Source: ${source}, State: ${JSON.stringify(state)}`);
      }
    }

    return {
      type: 'answer',
      message
    };
  }

  public async handleRetryQuery(request: AssistantConverseRequest, userId: string, language: string = 'es'): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const recent = await this.deps.executionRecordRepository.findRecent(1);

    if (recent.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "I don't have a recent execution to analyze." : "No tengo una ejecución reciente para analizar."
      };
    }

    const record = recent[0];
    const failures = record.actions.filter(a => a.status === 'failed');

    if (failures.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "The last action does not show any failures." : "La última acción no registra fallos."
      };
    }

    // Rule: If multi-command or scene, require confirmation
    const isComplex = record.sourceType === 'scene' || record.sourceType === 'automation' || record.actionCount > 1;

    if (isComplex && request.confirmed !== true) {
      // Re-use confirmation flow
      const intent: Intent = { type: 'retry', prompt: request.prompt };

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingIntent: { ...intent, timestamp: new Date().toISOString() },
        originalPrompt: request.prompt
      });

      const summary = isEn
        ? `I will retry ${failures.length} failed actions from the last ${record.sourceType}.`
        : `Voy a reintentar ${failures.length} acciones que fallaron en la última ${record.sourceType === 'scene' ? 'escena' : (record.sourceType === 'automation' ? 'automatización' : 'acción')}.`;

      return {
        type: 'clarification',
        message: summary,
        clarification: {
          question: isEn ? "Do you want to proceed?" : "¿Quieres continuar?",
          options: [
            { id: 'confirm', label: isEn ? "Yes, retry" : "Sí, reintenta", kind: 'device' },
            { id: 'cancel', label: isEn ? "No, cancel" : "No, cancelar", kind: 'device' }
          ],
          pendingAction: {
            originalPrompt: request.prompt
          }
        }
      };
    }

    // Execute Retry
    const correlationId = `assistant:retry:${Date.now()}`;
    const results = [];

    for (const fail of failures) {
      const device = await this.deps.deviceRepository.findDeviceById(fail.deviceId);
      const deviceName = device?.name ?? fail.deviceId;

      // We need the command. It's stored in SceneActionResult.command
      if (fail.command) {
        let commandName: DeviceCommandV1;
        if (typeof fail.command === 'string') {
          if (!isValidCommand(fail.command)) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`[AssistantRetry] Skipping invalid command: ${fail.command}`);
            }
            continue;
          }
          commandName = fail.command;
        } else {
          commandName = fail.command.name;
        }

        const result = await this.modules.commands.executeAuthorizedCommand(userId, fail.deviceId, commandName, request.prompt, correlationId);
        results.push({ deviceName, result });
      }
    }

    if (results.length === 0) {
      return {
        type: 'answer',
        message: isEn
          ? "I found failed actions, but I don't have enough command information to retry them."
          : "Encontré acciones fallidas, pero no tengo suficiente información del comando para reintentarlas."
      };
    }

    const allSuccess = results.every(r => r.result.status === 'success');

    if (allSuccess) {
      await this.modules.session.clearPendingAction(userId);
      return {
        type: 'execution',
        message: isEn ? "Done, I retried and it executed correctly." : "Listo, reintenté y ahora se ejecutó correctamente.",
        execution: {
          sceneId: 'assistant-retry',
          status: 'success',
          actions: results.flatMap(r => r.result.actions)
        }
      };
    } else {
      const firstFail = results.find(r => r.result.status === 'failed');
      const failMsg = firstFail?.result.actions[0]?.userMessage || firstFail?.result.actions[0]?.error || (isEn ? "Retry failed." : "El reintento falló.");
      return {
        type: 'error',
        message: failMsg,
        execution: {
          sceneId: 'assistant-retry',
          status: 'failed',
          actions: results.flatMap(r => r.result.actions)
        }
      };
    }
  }
}
