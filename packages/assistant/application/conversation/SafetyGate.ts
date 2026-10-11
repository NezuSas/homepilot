import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import { inferCommandFromPrompt } from './confirmationReplies';
import { containsWord, isManagementIntent } from './stateQueryIntents';
import { isDraftCreation } from './draftRequestParsing';
import { extractTargetPhrase } from './fastPathMatching';
import { withJarvisStyle } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Safety gate that blocks or clarifies commands with an unknown target. */
export class SafetyGate extends ConversationCollaborator {
  public async applySafetyGateV2(
    prompt: string,
    userId: string,
    language: 'es' | 'en',
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    const normalized = normalizeAssistantPrompt(prompt);
    const targetPhrase = extractTargetPhrase(prompt);

    // A. Unknown Target Blocker
    // If prompt has command verb + device noun + unknown qualifier
    const commandVerbs = ['prende', 'enciende', 'apaga', 'encender', 'apagar', 'activa', 'desactiva', 'abre', 'abrir', 'cierra', 'cerrar', 'turn on', 'turn off', 'open', 'close', 'toggle'];
    const hasVerb = commandVerbs.some(v => normalized.startsWith(v + ' ') || containsWord(normalized, v));

    if (isManagementIntent(normalized) || isDraftCreation(normalized)) return null;

    if (hasVerb && targetPhrase) {
      const isOrdinal = ['primera', 'segunda', 'la primera', 'la segunda', 'first', 'second', 'the first', 'the second'].includes(targetPhrase);
      const isPronoun = ['la', 'lo', 'las', 'los', 'it', 'them', 'esa', 'eso', 'esas', 'esos', 'that', 'those'].includes(targetPhrase) || normalized.endsWith('la') || normalized.endsWith('lo');
      const isMultiCommand = /\s(y|and|then|&)\s/i.test(normalized) || prompt.includes(',') || prompt.includes(';');
      const isBulk = normalized.includes('todo') || normalized.includes('everything');
      const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      const isRoomMentioned = rooms.some(r => normalized.includes(normalizeAssistantPrompt(r.name)));

      if (isOrdinal || isPronoun || isMultiCommand || isBulk || isRoomMentioned) {
        return null; // Let it pass to Follow-up resolver or Interpreter
      }

      const allMatches = await this.modules.devices.findMatchingDevices(prompt, userId);
      if (allMatches.length === 0) {
        // If it's a very vague "luz" or similar, maybe it's not an "unknown target" but a "vague light"
        const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
        if (!isVague) {
          // Attempt Fuzzy Matching before hard blocking
          const allDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);
          const command = (inferCommandFromPrompt(normalized) || 'turn_on') as DeviceCommandV1;
          const fuzzyResult = this.modules.devices.findFuzzyCandidateSuggestions(targetPhrase, allDevices, language, command, prompt);

          if (fuzzyResult) {
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
                  command: command,
                  prompt: prompt,
                  timestamp: new Date().toISOString()
                }
              });
            }
            return fuzzyResult;
          }

          console.info(`[ASSISTANT_SAFETY_GATE_BLOCK] ${JSON.stringify({ reason: 'unknown_target', targetLength: targetPhrase.length })}`);
          return withJarvisStyle({
            type: 'answer',
            message: language === 'en'
              ? `I couldn't find a device called '${targetPhrase}'.`
              : `No encontré un dispositivo llamado '${targetPhrase}'.`
          }, {
            status: 'not_found',
            searched: targetPhrase,
            userName: request.userName?.trim() || undefined
          }, language);
        }
      }

      if (allMatches.length > 1) {
        const command = (inferCommandFromPrompt(normalized) || 'turn_on') as DeviceCommandV1;
        const options = allMatches.map((device) => ({
          id: device.id,
          label: device.name,
          kind: 'device' as const
        }));

        await this.deps.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'clarification',
          entities: allMatches.map((device) => ({
            id: device.id,
            name: device.name,
            type: device.type,
            roomId: device.roomId
          })),
          timestamp: new Date().toISOString(),
          clarificationOptions: options,
          originalPrompt: prompt,
          pendingIntent: {
            type: 'command',
            deviceId: '',
            command,
            prompt,
            timestamp: new Date().toISOString()
          }
        });

        return withJarvisStyle({
          type: 'clarification',
          message: getAssistantResponseText('clarification.intent_multiple_matches', language, { segment: targetPhrase }),
          clarification: {
            question: getAssistantResponseText('clarification.which_one_do_you_mean', language, {}),
            options
          }
        }, {
          status: 'clarification',
          suggestions: options.map((option) => option.label),
          userName: request.userName?.trim() || undefined
        }, language);
      }
    }

    // B. Vague Light Blocker
    const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
    if (hasVerb && isVague && !request.sourceRoomId) {
      const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      const options = rooms.slice(0, 5).map(r => ({
        id: r.id,
        label: r.name,
        kind: 'room' as const
      }));

      const inferredCommand = (inferCommandFromPrompt(normalized) || 'turn_on') as DeviceCommandV1;
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'clarification',
        entities: [],
        timestamp: new Date().toISOString(),
        clarificationOptions: options,
        originalPrompt: prompt,
        pendingIntent: {
          type: 'command',
          deviceId: '',
          command: inferredCommand,
          prompt,
          timestamp: new Date().toISOString()
        }
      });

      console.info(`[ASSISTANT_SAFETY_GATE_BLOCK] Vague light without context`);
      return withJarvisStyle({
        type: 'clarification',
        message: language === 'en'
          ? "In which room do you want to control the light?"
          : "¿En qué estancia quieres controlar la luz?",
        clarification: {
          question: language === 'en' ? "Room selection" : "Selección de estancia",
          options
        }
      }, {
        status: 'clarification',
        suggestions: options.map(option => option.label),
        userName: request.userName?.trim() || undefined
      }, language);
    }

    return null;
  }
}
