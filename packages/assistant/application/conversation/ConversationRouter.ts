import { AssistantQuickResponseService } from '../AssistantQuickResponseService';
import type { AssistantConversationResponse, ConverseContext } from './conversationTypes';
import { isNameQuery, isHelpQuery, isPresentation, isScopeQuery, isDateTimeQuery, isHomeSummaryQuery, isAttentionQuery, isRecentActivityQuery, isConversationContextQuery, isGreeting, isWellnessQuery, isCompanyQuery } from './generalQueryIntents';
import { isDraftCreation } from './draftRequestParsing';
import { asksForSecondsDelay } from './unsupportedQualifiers';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { isRoomQuery, isRoomCreationIntent, isRoomCreationFollowUp, isRoomRenameIntent, isRoomDeletionIntent } from './roomIntents';
import { isRoomBulkFastPath, isRoomSingularLightFastPath, isRoomCoverFastPath, isBulkFastPath } from './fastPathMatching';
import { handleConversationContext, handleCompanyInfoQuery } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Deterministic routing: aliases, fast paths, general routes and the safety gate. */
export class ConversationRouter extends ConversationCollaborator {
  public async routeDeterministic(context: ConverseContext): Promise<AssistantConversationResponse | null> {
    const { request, prompt, userId, userName, normalized, memory, aliases, language } = context;

    // Date and time questions must be resolved before generic alias syntax such as "X es Y".
    if (isDateTimeQuery(normalized)) return await this.modules.homeInfo.handleDateTimeQuery(normalized, language);

    // --- 3. ALIAS MANAGEMENT ---
    if (this.deps.aliasManagementService.isAliasListQuery(normalized)) return await this.deps.aliasManagementService.handleAliasList(userId, language);
    const meaningAlias = this.deps.aliasManagementService.extractAliasMeaningQuery(normalized);
    if (meaningAlias) return await this.deps.aliasManagementService.handleAliasMeaning(userId, meaningAlias, language);
    const deleteAliasReq = isRoomDeletionIntent(normalized) ? null : this.deps.aliasManagementService.extractAliasDeleteRequest(normalized);
    if (deleteAliasReq) return await this.deps.aliasManagementService.handleAliasDeleteRequest(userId, deleteAliasReq, language, memory);
    if (this.deps.aliasManagementService.isAliasCreation(normalized)) return await this.deps.aliasManagementService.handleAliasCreation(normalized, userId, language);

    const activePrompt = normalized;


    // --- 4. ROOM CATEGORY FAST-PATHS ---
    // A room-qualified cover command must pass through the normal confirmation
    // policy before the generic device-name fast path can resolve it.
    const roomCover = isRoomCoverFastPath(normalized);
    if (roomCover) {
      const roomCoverResponse = await this.modules.roomFastPaths.handleRoomCoverFastPath(userId, roomCover.command, roomCover.roomName, language, prompt, aliases, userName, request);
      if (roomCoverResponse) return roomCoverResponse;
    }

    const conditionalRoutineResponse = await this.modules.drafts.handleConditionalRoutineRequest(normalized, language, userId, prompt);
    if (conditionalRoutineResponse) return conditionalRoutineResponse;
    const relativeTimerResponse = await this.modules.drafts.handleRelativeTimerRequest(normalized, language, userId, prompt);
    if (relativeTimerResponse) return relativeTimerResponse;
    if (asksForSecondsDelay(normalized)) {
      return { type: 'answer', message: getAssistantResponseText('command.seconds_delay_unsupported', language, {}) };
    }

    const mediaPlayerResponse = await this.modules.mediaPlayer.handleMediaPlayerRequest(normalized, userId, language, prompt, memory);
    if (mediaPlayerResponse) return mediaPlayerResponse;

    // --- 5. EXACT/STRONG FAST-PATH ---
    const fastPathResponse = await this.modules.hooks.attemptFastPathExecution(activePrompt, userId, language, userName);
    if (fastPathResponse) return fastPathResponse;

    const roomSingular = isRoomSingularLightFastPath(normalized);
    if (roomSingular) {
      const singularResponse = await this.modules.roomFastPaths.handleRoomSingularLightFastPath(userId, roomSingular.command, roomSingular.roomName, language, prompt, aliases);
      if (singularResponse) return singularResponse;
    }

    const roomBulk = isRoomBulkFastPath(normalized);
    if (roomBulk) return await this.modules.roomFastPaths.handleRoomBulkFastPath(userId, roomBulk.command, roomBulk.roomName, roomBulk.bulkType, language, prompt, aliases);

    // --- 6. GLOBAL BULK FAST-PATH ---
    const globalBulk = isBulkFastPath(normalized);
    if (globalBulk) { const bulkResponse = await this.modules.roomFastPaths.handleBulkFastPath(normalized, globalBulk.bulkType, globalBulk.command, language, userId); if (bulkResponse) return bulkResponse; }

    // --- 7. DEVICE ALIAS FAST-PATH ---
    const deviceAliasFastPath = await this.modules.hooks.attemptDeviceAliasFastPathExecution(activePrompt, userId, language, aliases);
    if (deviceAliasFastPath) return deviceAliasFastPath;

    // --- DETERMINISTIC GENERAL ROUTES ---
    if (isHomeSummaryQuery(normalized)) return await this.modules.homeInfo.handleHomeSummary(language, userId);
    if (isDraftCreation(normalized)) return await this.modules.drafts.handleDraftCreation(normalized, language, userId, prompt);
    if (isRoomCreationIntent(normalized) || isRoomRenameIntent(normalized) || isRoomDeletionIntent(normalized)) return await this.modules.management.handleManagementIntent(normalized, userId, language, prompt);
    if (isRoomCreationFollowUp(normalized, memory)) return await this.modules.management.handleManagementIntent('agregar una estancia', userId, language);
    if (isRoomQuery(normalized)) return await this.modules.homeInfo.handleRoomQuery(language, userId);
    if (isAttentionQuery(normalized)) return await this.modules.homeInfo.handleAttentionQuery(language, userId);
    if (isRecentActivityQuery(normalized)) return await this.modules.homeInfo.handleRecentActivity(language);
    if (isConversationContextQuery(normalized)) return handleConversationContext(memory, language);
    if (isGreeting(normalized)) return AssistantQuickResponseService.format('greeting', language, userName);
    if (isWellnessQuery(normalized)) return AssistantQuickResponseService.format('wellness', language, userName);
    if (isNameQuery(normalized)) return AssistantQuickResponseService.format('name', language, userName);
    if (isCompanyQuery(normalized)) return handleCompanyInfoQuery(language);
    if (isHelpQuery(normalized) || isPresentation(normalized) || isScopeQuery(normalized)) return await this.modules.homeInfo.handleCapabilitiesGuide(userId, language);

    // --- 8. CONTEXT ROOM FAST-PATH ---
    const contextRoomFastPath = await this.modules.hooks.attemptContextRoomFastPathExecution(activePrompt, request.sourceRoomId, userId, userName, language, aliases);
    if (contextRoomFastPath) return contextRoomFastPath;

    // --- 9. SAFETY GATE V2 ---
    const safetyResult = await this.modules.hooks.applySafetyGateV2(activePrompt, userId, language, request);
    if (safetyResult) return safetyResult;

    return null;
  }
}
