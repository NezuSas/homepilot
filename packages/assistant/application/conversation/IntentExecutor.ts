import type { Intent } from '../ports/IntentInterpreterPort';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { isLikelyHomeControlPrompt } from './generalQueryIntents';
import { extractTargetPhrase } from './fastPathMatching';
import { withJarvisStyle } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Resolves ambiguity and confirmation for an interpreted intent and dispatches its execution. */
export class IntentExecutor extends ConversationCollaborator {
  public async executeIntent(
    intent: Intent,
    request: AssistantConverseRequest,
    language: string,
    userId: string,
    userName: string | null,
    prompt: string,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse> {
    const t0 = Date.now();
    const namePrefix = userName ? `${userName}, ` : '';
    const correlationId = `assistant:chat:${t0}`;

    if (intent.type === 'unknown') {
      if (isLikelyHomeControlPrompt(normalizeAssistantPrompt(prompt))) {
        return {
          type: 'answer',
          message: getAssistantResponseText('command.not_understood', language, {})
        };
      }

      return this.deps.smallTalkService.handle(prompt, language, userName, userId);
    }

    // Check for ambiguity (deterministic V1 only for now)
    if (intent.type === 'command') {
      // 1. Room-specific command?
      if (intent.roomId && !intent.deviceId) {
        if (intent.command === 'turn_on' || intent.command === 'turn_off') {
          return await this.modules.selection.handleRoomSelectionForLight(intent.roomId, intent.command, userId, language, prompt, correlationId);
        }
      }

      const allMatches = await this.modules.devices.findMatchingDevices(prompt, userId);

      if (!intent.deviceId && allMatches.length === 0) {
        const targetPhrase = extractTargetPhrase(prompt);
        const allDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);
        const fuzzyResult = this.modules.devices.findFuzzyCandidateSuggestions(targetPhrase, allDevices, language, intent.command, prompt);

        if (fuzzyResult) {
          // If we have a fuzzy clarification, save it to memory
          if (fuzzyResult.type === 'clarification' && fuzzyResult.clarification) {
            await this.deps.memoryService.saveShortTermMemory(userId, {
              lastQueryType: 'clarification',
              entities: [],
              timestamp: new Date().toISOString(),
              clarificationOptions: fuzzyResult.clarification.options,
              originalPrompt: prompt,
              pendingIntent: {
                type: 'command',
                deviceId: '',
                command: intent.command,
                prompt,
                timestamp: new Date().toISOString()
              }
            });
          }
          return fuzzyResult;
        }

        return withJarvisStyle({
          type: 'answer',
          message: getAssistantResponseText('resolution.device_not_found', language, { targetPhrase })
        }, {
          status: 'not_found',
          searched: targetPhrase,
          userName: userName || undefined
        }, language);
      }

      if (allMatches.length > 1) {
        const targetPhrase = extractTargetPhrase(prompt);
        const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
        if (isVague && !request.sourceRoomId) {
          return {
            type: 'clarification',
            message: getAssistantResponseText('clarification.vague_light_room', language, {}),
            clarification: {
              question: getAssistantResponseText('clarification.vague_light_room_example', language, {}),
              options: []
            }
          };
        }

        // Save to memory for future resolution (e.g. "la primera")
        const options = allMatches.map(d => ({
          id: d.id,
          label: d.name,
          kind: 'device' as const
        }));

        await this.deps.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'clarification',
          entities: allMatches.map(d => ({ id: d.id, name: d.name, type: d.type, roomId: d.roomId })),
          timestamp: new Date().toISOString(),
          clarificationOptions: options,
          pendingIntent: { ...intent, timestamp: new Date().toISOString() },
          originalPrompt: prompt
        });

      return withJarvisStyle({
        type: 'clarification',
        message: getAssistantResponseText('clarification.device_multiple_matches', language, {}),
          clarification: {
            question: getAssistantResponseText('clarification.device_multiple_matches_question', language, {}),
            options,
            pendingAction: {
              command: intent.type === 'command' ? intent.command : undefined,
              targetId: undefined,
              originalPrompt: prompt
            }
          }
        }, {
          status: 'clarification',
          suggestions: options.map(option => option.label),
          userName: userName || undefined
        }, language);
      } else if (allMatches.length === 1) {
        // V2: Save single match to memory for follow-ups — fire-and-forget
        this.deps.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'intent_match',
          entities: allMatches.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            roomId: d.roomId
          })),
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }
    }

    // D) Confirmation Policy
    const preview = await this.deps.confirmationPolicy.evaluate(intent, language, userId);
    if (preview.requiresConfirmation && request.confirmed !== true) {
      // Save pending intent to memory
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: intent.type === 'command' ? [{ id: intent.deviceId, name: 'Target', type: 'device', roomId: null }] : [],
        timestamp: new Date().toISOString(),
        pendingIntent: { ...intent, timestamp: new Date().toISOString() },
        originalPrompt: prompt
      });

      return withJarvisStyle({
        type: 'clarification',
        message: `${namePrefix}${preview.reason} ${preview.summary}`.trim(),
        clarification: {
          question: getAssistantResponseText('confirmation.generic_proceed', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.generic_proceed_yes', language, {}), kind: 'device' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.generic_proceed_no', language, {}), kind: 'device' }
          ],
          pendingAction: {
            command: intent.type === 'command' ? intent.command : undefined,
            targetId: intent.type === 'command' ? intent.deviceId : (intent.type === 'scene' ? intent.target : undefined),
            originalPrompt: prompt
          }
        }
      }, {
        status: 'security_blocked',
        reason: 'mass_action_requires_confirmation',
        target: preview.summary,
        userName: userName || undefined
      }, language);
    }

    // E) Execution
    if (intent.type === 'scene') {
      const scene = await this.deps.sceneRepository.findSceneById(intent.target);
      if (!scene || scene.userId !== userId) return { type: 'error', message: getAssistantResponseText('scene.not_found', language, {}) };

      await this.deps.permissionGate.assertSceneAuthorized(userId, scene);

      const result = await this.deps.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });

      // Clear pending confirmation if successful
      await this.modules.session.clearPendingAction(userId);

      // Record learning event
      this.deps.learningService.recordSceneUsed(userId, scene, prompt).catch(() => {});

      return await this.modules.session.attachSuggestionIfNeeded({
        type: 'execution',
        message: getAssistantResponseText('scene.execution_started', language, {}),
        execution: result
      }, userId, language, memory, 'scene');
    }

    if (intent.type === 'command') {
      return await this.modules.intentRunner.executeCommandIntent(intent, request, language, userId, userName, prompt, memory, correlationId);
    }

    if (intent.type === 'multi_command') {
      return await this.modules.intentRunner.executeMultiCommandIntent(intent, request, language, userId, userName, prompt, memory, correlationId);
    }

    if (intent.type === 'explain') {
      return await this.modules.history.handleExplainQuery(intent.targetId, language);
    }

    if (intent.type === 'retry') {
      return await this.modules.history.handleRetryQuery(request, userId, language);
    }

    return {
      type: 'error',
      message: getAssistantResponseText('intent.not_recognized', language, {})
    };
  }
}
