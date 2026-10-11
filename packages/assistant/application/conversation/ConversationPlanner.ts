import { DeviceCommandV1 } from '../../../devices/domain/commands';
import type { Intent } from '../ports/IntentInterpreterPort';
import { AssistantMemoryEntity, AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { ResolvedFollowUp } from '../ports/FollowUpResolverPort';
import { ASSISTANT_RESPONSE_PREFERENCE_KEY, detectAssistantResponsePreferenceCommand, getAssistantResponsePreferenceAcknowledgement } from '../response/AssistantResponsePreference';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse, ConverseContext } from './conversationTypes';
import { isIntent, isClarificationKind } from './conversationTypeGuards';
import { inferCommandFromPrompt } from './confirmationReplies';
import { isEquivalenceQuery, isDomesticSkillFollowUpPrompt, isDomesticRecommendationPrompt, isLikelyHomeControlPrompt } from './generalQueryIntents';
import { isStateQuery, isDetailFollowUp, isSensorReadingQuery, isPointStateQuery, isListScenesIntent, isListTimersIntent, isListAutomationsIntent, isManagementIntent } from './stateQueryIntents';
import { isDraftCreation } from './draftRequestParsing';
import { isRoomQuery, isRoomCreationIntent, isRoomRenameIntent, isRoomDeletionIntent } from './roomIntents';
import { withJarvisStyle, handleEquivalenceQuery } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Follow-up resolution, planner fallback, small talk and intent interpretation. */
export class ConversationPlanner extends ConversationCollaborator {
  public async plan(context: ConverseContext): Promise<AssistantConversationResponse> {
    const { request, prompt, userId, userName, memory, aliases, language, responsePreference, conversationTone } = context;

    // --- 10. FOLLOW-UP RESOLVER ---
    let activePrompt = prompt;
    let followUp: ResolvedFollowUp = { resolvedPrompt: prompt, handled: false, referencesMemory: false };
    followUp = this.deps.followUpResolver.resolve(prompt, memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }, language, aliases);
    if (followUp.handled && followUp.response) return { type: 'answer', message: followUp.response };
    activePrompt = followUp.resolvedPrompt;

    // --- 11. PLANNER V2 / V1 FALLBACK ---
    const resolvedNormalized = normalizeAssistantPrompt(activePrompt);
    if (isEquivalenceQuery(resolvedNormalized)) return handleEquivalenceQuery(language);
    if (isDraftCreation(resolvedNormalized)) return await this.modules.drafts.handleDraftCreation(resolvedNormalized, language, userId, activePrompt);
    if (isRoomCreationIntent(resolvedNormalized) || isRoomRenameIntent(resolvedNormalized) || isRoomDeletionIntent(resolvedNormalized)) return await this.modules.management.handleManagementIntent(resolvedNormalized, userId, language, activePrompt);
    if (isRoomQuery(resolvedNormalized)) return await this.modules.homeInfo.handleRoomQuery(language, userId);
    if (isSensorReadingQuery(resolvedNormalized)) return await this.modules.readings.handleSensorReadingQuery(resolvedNormalized, language, userId);
    if (isPointStateQuery(resolvedNormalized)) return await this.modules.readings.handlePointStateQuery(resolvedNormalized, language, userId);
    if (isStateQuery(resolvedNormalized)) return await this.modules.stateQueries.handleStateQuery(resolvedNormalized, language, userName, userId, followUp.referencesMemory ? memory?.entities : undefined, request.sourceRoomId);
    if (isManagementIntent(resolvedNormalized)) return await this.modules.management.handleManagementIntent(resolvedNormalized, userId, language);
    if (isListScenesIntent(resolvedNormalized)) return await this.modules.homeInfo.handleListScenes(language, userId);
    if (isListTimersIntent(resolvedNormalized)) return await this.modules.homeInfo.handleListTimers(language, userId);
    if (isListAutomationsIntent(resolvedNormalized)) return await this.modules.homeInfo.handleListAutomations(language, userId);
    if (isDetailFollowUp(resolvedNormalized) && memory?.lastQueryType === 'state_devices' && memory.entities && memory.entities.length > 0) return await this.modules.readings.handleDetailFollowUp(memory, language, userId);

    const responsePreferenceOverride = detectAssistantResponsePreferenceCommand(resolvedNormalized);
    if (responsePreferenceOverride && !isLikelyHomeControlPrompt(resolvedNormalized)) {
      await this.deps.memoryService.setUserPreference(
        userId,
        ASSISTANT_RESPONSE_PREFERENCE_KEY,
        responsePreferenceOverride
      );
      return {
        type: 'answer',
        message: getAssistantResponsePreferenceAcknowledgement(responsePreferenceOverride, language)
      };
    }

    const domesticSkillResponse = await this.deps.domesticSkillResolver.resolve(activePrompt, userId, language);
    const domesticFollowUpResponse = await this.handleDomesticSkillFollowUp(resolvedNormalized, memory, userId, language);
    if (domesticFollowUpResponse) return this.modules.session.finalizeResponse(language, domesticFollowUpResponse, 'standard', false);
    if (domesticSkillResponse) {
      const roomEntity: AssistantMemoryEntity[] = domesticSkillResponse.context.room
        ? [{
          id: domesticSkillResponse.context.room.id,
          name: domesticSkillResponse.context.room.name,
          type: 'room',
          roomId: domesticSkillResponse.context.room.id,
          roomName: domesticSkillResponse.context.room.name
        }]
        : [];
      await this.deps.memoryService.saveShortTermMemory(userId, {
        ...(memory ?? {}),
        lastQueryType: 'domestic_skill',
        entities: [...roomEntity, ...domesticSkillResponse.context.entities],
        timestamp: new Date().toISOString()
      });
      return this.modules.session.finalizeResponse(
        language,
        { type: 'answer', message: domesticSkillResponse.message },
        'standard',
        false
      );
    }

    if (!isLikelyHomeControlPrompt(resolvedNormalized)) {
      const conversationalResponse = await this.deps.smallTalkService.handle(activePrompt, language, userName, userId);
      if (conversationTone !== 'neutral') {
        const prefix = conversationTone === 'warm'
          ? (language === 'en' ? 'Of course. ' : 'Con gusto. ')
          : (language === 'en' ? 'Understood. ' : 'Entendido. ');
        conversationalResponse.message = `${prefix}${conversationalResponse.message}`;
      }
      return this.modules.session.finalizeResponse(language, conversationalResponse, responsePreference, true);
    }

    const intentResult = await this.deps.intentInterpreter.interpret(activePrompt, userId);
    if (intentResult && 'type' in intentResult) {
      if (intentResult.type === 'failure') return { type: 'error', message: intentResult.message };
      if (intentResult.type === 'clarificationRequired') {
        const inferredCommand = inferCommandFromPrompt(intentResult.originalSegment) || inferCommandFromPrompt(activePrompt) || 'turn_on';
        await this.deps.memoryService.saveShortTermMemory(userId, { lastQueryType: 'clarification', entities: [], timestamp: new Date().toISOString(), clarificationOptions: intentResult.options, originalPrompt: activePrompt, pendingIntent: { type: 'command', deviceId: '', command: inferredCommand as DeviceCommandV1, prompt: activePrompt, timestamp: new Date().toISOString() } });
        const options = intentResult.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' }));
        return this.modules.session.finalizeResponse(language, withJarvisStyle({ type: 'clarification', message: getAssistantResponseText('clarification.intent_multiple_matches', language, { segment: intentResult.originalSegment }), clarification: { question: getAssistantResponseText('clarification.which_one_do_you_mean', language, {}), options } }, {
          status: 'clarification',
          suggestions: options.map(option => option.label),
          userName: userName || undefined
        }, language));
      }
    }

    let intent: Intent;
    if (intentResult && 'type' in intentResult && intentResult.type === 'success') intent = intentResult.intent;
    else if (isIntent(intentResult)) intent = intentResult;
    else intent = { type: 'unknown', prompt: activePrompt, reason: 'Invalid interpretation result' };

    if (intent && intent.type !== 'unknown' && (memory?.pendingIntent || memory?.pendingDraft)) await this.modules.session.clearPendingAction(userId);
    return this.modules.session.finalizeResponse(language, await this.modules.hooks.executeIntent(intent || { type: 'unknown', prompt: activePrompt }, request, language, userId, userName, activePrompt, memory));
  }

  public async handleDomesticSkillFollowUp(
    normalized: string,
    memory: AssistantMemoryState | null,
    userId: string,
    language: 'es' | 'en'
  ): Promise<AssistantConversationResponse | null> {
    if (!memory || memory.lastQueryType !== 'domestic_skill' || memory.entities.length === 0 || !isDomesticSkillFollowUpPrompt(normalized)) return null;

    const [devices, scenes] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedScenes(userId)
    ]);
    const availableDeviceIds = new Set(devices.filter((device) => this.deps.scopeFilter.isDeviceAvailable(device)).map((device) => device.id));
    const availableSceneIds = new Set(scenes.map((scene) => scene.id));
    const candidates = memory.entities.filter((entity) => entity.type === 'scene'
      ? availableSceneIds.has(entity.id)
      : entity.type !== 'room' && availableDeviceIds.has(entity.id));

    if (candidates.length === 0) {
      return {
        type: 'answer',
        message: language === 'en' ? 'Those previous options are no longer available. Ask me for current options and I will check again.' : 'Las opciones anteriores ya no están disponibles. Pídeme las opciones actuales y las revisaré de nuevo.'
      };
    }

    const preferredScene = candidates.find((entity) => entity.type === 'scene');
    if (isDomesticRecommendationPrompt(normalized) && preferredScene) {
      const command = language === 'en' ? `activate ${preferredScene.name}` : `activa ${preferredScene.name}`;
      return {
        type: 'answer',
        message: language === 'en' ? `From the options I found, I recommend ${preferredScene.name}. To use it, say: “${command}”.` : `De las opciones que encontré, te recomiendo ${preferredScene.name}. Para usarla, puedes decir: “${command}”.`
      };
    }

    const listedCandidates = candidates.slice(0, 4).map((entity) => `• ${entity.name}`).join('\n');
    return {
      type: 'answer',
      message: language === 'en' ? `The options from the previous recommendation that are still available are:\n${listedCandidates}` : `Las opciones de la recomendación anterior que siguen disponibles son:\n${listedCandidates}`
    };
  }
}
