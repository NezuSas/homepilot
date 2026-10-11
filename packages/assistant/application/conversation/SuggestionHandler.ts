import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse, PendingSuggestion } from './conversationTypes';
import { isStringArray } from './conversationTypeGuards';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Accept, reject and postpone flows for proactive suggestions. */
export class SuggestionHandler extends ConversationCollaborator {
  public async handleSuggestionAccept(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';

    await this.deps.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'accepted');

    let message = isEn ? "Done! I've created a draft for you." : "¡Listo! He creado un borrador para ti.";

    if (suggestion.type === 'alias_suggestion') {
      const metadata = suggestion.metadata;
      const alias = typeof metadata['alias'] === 'string' ? metadata['alias'] : undefined;
      const target = typeof metadata['target'] === 'string' ? metadata['target'] : undefined;
      const confidence = typeof metadata['confidence'] === 'string' ? metadata['confidence'] : undefined;

      if (confidence === 'high' && alias && target) {
        const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
        const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);

        const matchingDevices = devices.filter(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(target));
        const matchingRooms = rooms.filter(r => normalizeAssistantPrompt(r.name) === normalizeAssistantPrompt(target));

        const totalMatches = matchingDevices.length + matchingRooms.length;

        // Safety: check alias does not match existing device name
        const nameCollision = devices.some(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(alias));
        // Safety: check alias does not already exist
        const existingAlias = await this.deps.memoryService.getAlias(userId, alias);

        if (totalMatches === 1 && !nameCollision && !existingAlias) {
          const targetEntity = matchingDevices.length > 0 ? matchingDevices[0] : matchingRooms[0];
          const type = matchingDevices.length > 0 ? 'device' : 'room';

          await this.deps.memoryService.setAlias(userId, alias, targetEntity.id);

          console.info(`[ASSISTANT_USER_ALIAS_CREATED] ${JSON.stringify({ userId, targetId: targetEntity.id, type })}`);

          message = isEn
            ? `Alias created: from now on I'll understand "${alias}" as "${targetEntity.name}".`
            : `Alias creado: a partir de ahora entenderé "${alias}" como "${targetEntity.name}".`;
        } else {
          if (existingAlias) {
            message = isEn
              ? `I already have an alias for "${alias}".`
              : `Ya tengo un alias para "${alias}".`;
          } else if (nameCollision) {
            message = isEn
              ? `I cannot use "${alias}" as an alias because a device already has that name.`
              : `No puedo usar "${alias}" como alias porque un dispositivo ya tiene ese nombre.`;
          } else if (totalMatches > 1) {
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, reason: 'ambiguous' })}`);
            message = isEn
              ? `I found multiple items named "${target}". Please be more specific.`
              : `Encontré varios elementos llamados "${target}". Por favor, sé más específico.`;
          } else {
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, reason: 'not_found' })}`);
            message = isEn
              ? `I couldn't find the device or room "${target}" to create the alias.`
              : `No encontré el dispositivo o estancia "${target}" para crear el alias.`;
          }
        }
      }
    } else if (suggestion.type === 'scene_suggestion' || suggestion.type === 'automation_suggestion') {
      const metadata = suggestion.metadata;
      const roomId = typeof metadata['roomId'] === 'string' ? metadata['roomId'] : undefined;
      const deviceIds = isStringArray(metadata['deviceIds']) ? metadata['deviceIds'] : undefined;
      const deviceId = typeof metadata['deviceId'] === 'string' ? metadata['deviceId'] : undefined;
      const hour = typeof metadata['hour'] === 'number' ? String(metadata['hour']) : undefined;
      const homeId = typeof metadata['homeId'] === 'string' ? metadata['homeId'] : undefined;

      if (homeId) {
        if (suggestion.type === 'scene_suggestion' && deviceIds) {
          await this.deps.draftService.createDraft(userId, 'scene', {
            roomId, deviceIds, homeId
          });
          message = isEn
            ? "I've created a scene draft with those devices. You can find it in your drafts."
            : "He creado un borrador de escena con esos dispositivos. Puedes encontrarlo en tus borradores.";
        } else if (suggestion.type === 'automation_suggestion' && deviceId) {
          await this.deps.draftService.createDraft(userId, 'automation', {
            deviceId, hour, homeId, trigger: { type: 'time', hour: Number(hour) }
          });
          message = isEn
            ? "I've created an automation draft for you. You can review it in your drafts."
            : "He creado un borrador de automatización para ti. Puedes revisarlo en tus borradores.";
        }
      }
    }

    await this.modules.session.clearPendingAction(userId);
    return { type: 'answer', message };
  }

  public async handleSuggestionReject(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    await this.deps.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'rejected');
    await this.modules.session.clearPendingAction(userId);
    return {
      type: 'answer',
      message: language === 'en' ? "Understood, I won't suggest this again for now." : "Entendido, no volveré a sugerirte esto por ahora."
    };
  }

  public async handleSuggestionPostpone(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    await this.deps.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'postponed');
    await this.modules.session.clearPendingAction(userId);
    return {
      type: 'answer',
      message: language === 'en' ? "Okay, I'll remind you later." : "Está bien, te lo recordaré más tarde."
    };
  }
}
