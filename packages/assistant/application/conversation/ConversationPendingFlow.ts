import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, ConverseContext } from './conversationTypes';
import { isPendingSuggestion, isIntent, isClarificationKind } from './conversationTypeGuards';
import { isPendingIntentConfirmationActive, isConfirmation, isPositiveConfirmation, isNegativeConfirmation, isSuggestionAccept, isSuggestionReject, isSuggestionPostpone, isBulkActionAccept, isBulkActionReject, resolveSelectionFromMemory, inferCommandFromPrompt, resolvePronounIntent } from './confirmationReplies';
import { isLikelyHomeControlPrompt } from './generalQueryIntents';
import { containsWord, isManagementIntent } from './stateQueryIntents';
import { isRoomBulkFastPath, isBulkFastPath } from './fastPathMatching';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Resolution of pending confirmations, clarification selections and pronouns. */
export class ConversationPendingFlow extends ConversationCollaborator {
  public async resolveConfirmations(context: ConverseContext): Promise<AssistantConversationResponse | null> {
    const { request, prompt, userId, userName, normalized, memory, language } = context;
    const activePrompt = prompt;

    // --- 1. PENDING CONFIRMATIONS / SELECTED OPTION ---
    // A) Management Confirmation
    if (memory?.pendingManagementAction) {
      const isAffirmative = request.selectedOptionId === 'confirm' || isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || isNegativeConfirmation(normalized);
      if (isAffirmative) return this.modules.session.finalizeResponse(language, await this.modules.managementActions.executeManagementAction(memory.pendingManagementAction, userId, language));
      if (isNegative) { await this.modules.session.clearPendingAction(userId); return this.modules.session.finalizeResponse(language, { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }); }
    }

    // B) Alias Delete Confirmation
    if (memory?.pendingAliasDelete) {
      const isAffirmative = request.selectedOptionId === 'confirm' || isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || isNegativeConfirmation(normalized);
      if (isAffirmative) { await this.deps.memoryService.deleteAlias(userId, memory.pendingAliasDelete.alias); await this.modules.session.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('alias.deleted', language, { alias: memory.pendingAliasDelete.alias }) }; }
      if (isNegative) { await this.modules.session.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }; }
    }

    // C) Bulk Action Confirmation — persisted ticket, single-use, TTL enforced by the
    // repository query itself (no separate in-code timestamp/window to keep in sync).
    if (this.deps.confirmationTicketRepository) {
      const pendingTicket = await this.deps.confirmationTicketRepository.findActiveByUserId(userId);
      if (pendingTicket) {
        if (isBulkActionAccept(normalized)) return await this.modules.bulkConfirmations.handleBulkActionAccept(userId, language, pendingTicket);
        if (isBulkActionReject(normalized)) return await this.modules.bulkConfirmations.handleBulkActionReject(userId, language, pendingTicket);
      }
    }

    // D) Draft Confirmation
    if (memory?.pendingDraft) {
      const isAffirmative = request.selectedOptionId === 'confirm' || isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || isNegativeConfirmation(normalized);
      if (isAffirmative) {
        try { await this.deps.draftService.activateDraft(memory.pendingDraft.id, userId); await this.modules.session.clearPendingAction(userId); return this.modules.session.finalizeResponse(language, { type: 'answer', message: getAssistantResponseText('draft.activated', language, { draftType: memory.pendingDraft.type === 'scene' ? 'scene' : 'routine' }) }); }
        catch (err: unknown) { return this.modules.session.finalizeResponse(language, { type: 'error', message: getAssistantResponseText('draft.activation_failed', language, {}) }); }
      }
      if (isNegative) { await this.modules.session.clearPendingAction(userId); return this.modules.session.finalizeResponse(language, { type: 'answer', message: getAssistantResponseText('draft.cancelled', language, { draftType: memory.pendingDraft.type === 'scene' ? 'scene' : 'routine' }) }); }
    }

    // E) Selected Option Flow (UI clicks)
    if (request.selectedOptionId) {
      if (memory?.source === 'sensor_reading') {
        return await this.modules.readings.handleSensorReadingSelection(userId, request.selectedOptionId, language);
      }
      if (memory?.pendingIntent && (request.selectedOptionId === 'confirm' || request.selectedOptionId === 'cancel')) {
        if (!isPendingIntentConfirmationActive(memory.pendingIntent)) {
          await this.modules.session.clearPendingAction(userId);
          return {
            type: 'answer',
            message: getAssistantResponseText('confirmation.expired', language, {})
          };
        }
        if (request.selectedOptionId === 'confirm') { request.confirmed = true; return this.modules.session.finalizeResponse(language, await this.modules.hooks.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory)); }
        else { await this.modules.session.clearPendingAction(userId); return this.modules.session.finalizeResponse(language, { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }); }
      }
      return await this.modules.selection.handleSelection(request, language);
    }

    // F) Natural Language Confirmations (Yes/No)
    if (isConfirmation(normalized)) {
      if (memory?.pendingIntent) {
        const isClarificationSelection = memory.clarificationOptions
          && memory.clarificationOptions.length > 0
          && memory.pendingIntent.type === 'command'
          && !memory.pendingIntent.deviceId;
        if (!isClarificationSelection && isPendingIntentConfirmationActive(memory.pendingIntent)) {
          if (isPositiveConfirmation(normalized)) { request.confirmed = true; return await this.modules.hooks.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory); }
          else if (isNegativeConfirmation(normalized)) { await this.modules.session.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }; }
        } else if (!isClarificationSelection) {
          await this.modules.session.clearPendingAction(userId);
          return {
            type: 'answer',
            message: getAssistantResponseText('confirmation.expired', language, {})
          };
        }
      }
      const pendingSuggestion = memory?.pendingSuggestion;
      if (isPendingSuggestion(pendingSuggestion)) {
        if (isSuggestionAccept(normalized)) return await this.modules.suggestions.handleSuggestionAccept(userId, language, pendingSuggestion);
        if (isSuggestionReject(normalized)) return await this.modules.suggestions.handleSuggestionReject(userId, language, pendingSuggestion);
        if (isSuggestionPostpone(normalized)) return await this.modules.suggestions.handleSuggestionPostpone(userId, language, pendingSuggestion);
      }

      if (isPositiveConfirmation(normalized) && memory?.clarificationOptions?.length === 1) {
        const selectedOption = memory.clarificationOptions[0];
        if (memory.source === 'sensor_reading') {
          return await this.modules.readings.handleSensorReadingSelection(userId, selectedOption.id, language);
        }

        const command = memory.pendingIntent?.type === 'command'
          ? memory.pendingIntent.command
          : inferCommandFromPrompt(memory.originalPrompt || prompt) as DeviceCommandV1 | undefined;

        if (command) {
          request.pendingAction = {
            command,
            targetId: selectedOption.id,
            originalPrompt: memory.originalPrompt || prompt
          };
          return await this.modules.selection.handleSelection(request, language);
        }
      }

      if (isPositiveConfirmation(normalized) && memory?.clarificationOptions && memory.clarificationOptions.length > 1) {
        return {
          type: 'clarification',
          message: getAssistantResponseText('clarification.device_multiple_matches', language, {}),
          clarification: {
            question: getAssistantResponseText('clarification.which_one', language, {}),
            options: memory.clarificationOptions
          }
        };
      }

      if (isPositiveConfirmation(normalized)) return { type: 'answer', message: getAssistantResponseText('confirmation.none_pending', language, {}) };
    }

    return null;
  }

  public async resolveClarificationSelection(context: ConverseContext): Promise<AssistantConversationResponse | null> {
    const { request, prompt, userId, normalized, memory, language } = context;

    // --- 2. NATURAL-LANGUAGE CLARIFICATION SELECTION FROM MEMORY ---
    if (memory?.clarificationOptions && memory.clarificationOptions.length > 0) {
      const isExactLabel = memory.clarificationOptions.some(opt => opt.label.toLowerCase() === normalized);
      if (!isExactLabel && !this.isClarificationSelectionReply(normalized)) {
        // New intent detected: clear stale clarification but allow the rest of the pipeline to run
        const { clarificationOptions, pendingIntent, originalPrompt, ...rest } = memory;
        // Only clear pendingIntent/originalPrompt if they seem to belong to the clarification (e.g. vague light)
        const isVagueClarification = memory.lastQueryType === 'clarification' || memory.source === 'context_room';

        const newMemory = {
          ...rest,
          clarificationOptions: undefined,
          pendingIntent: isVagueClarification ? undefined : pendingIntent,
          originalPrompt: isVagueClarification ? undefined : originalPrompt
        };

        await this.deps.memoryService.saveShortTermMemory(userId, newMemory);
        // Update local memory for the rest of this execution
        memory.clarificationOptions = undefined;
        if (isVagueClarification) {
           memory.pendingIntent = undefined;
           memory.originalPrompt = undefined;
        }
      } else {
        let selectionPrompt = normalized;
        if (normalized.startsWith('y ') || normalized.startsWith('and ')) selectionPrompt = normalized.substring(normalized.startsWith('y ') ? 2 : 4).trim();
        const selectedId = resolveSelectionFromMemory(selectionPrompt, memory.clarificationOptions, language);
        if (selectedId) {
          if (memory.source === 'sensor_reading') {
            return await this.modules.readings.handleSensorReadingSelection(userId, selectedId, language);
          }
          const selectedOption = memory.clarificationOptions.find(opt => opt.id === selectedId);
          let command = memory.pendingIntent?.type === 'command' ? memory.pendingIntent.command : undefined;
          if (!command) command = inferCommandFromPrompt(memory.originalPrompt || prompt) as DeviceCommandV1 | undefined;
          if (command) { request.pendingAction = { command, targetId: selectedId, originalPrompt: memory.originalPrompt || prompt }; return await this.modules.selection.handleSelection(request, language); }
          else {
            await this.deps.memoryService.saveShortTermMemory(userId, { ...memory, entities: [{ id: selectedId, name: selectedOption?.label || 'Selected', type: 'device', roomId: null }], timestamp: new Date().toISOString() });
            return { type: 'answer', message: getAssistantResponseText('selection.follow_up_selected', language, { label: selectedOption?.label ?? 'Selected' }) };
          }
        }
      }
    }

    return null;
  }

  public async resolvePronoun(context: ConverseContext): Promise<AssistantConversationResponse | null> {
    const { request, prompt, userId, userName, normalized, memory, language } = context;

    // --- PRE-INTENT: PRONOUN RESOLUTION ---
    const pronounIntent = await resolvePronounIntent(normalized, memory, language);
    if (pronounIntent) {
      if ('type' in pronounIntent && pronounIntent.type === 'clarificationRequired') return { type: 'clarification', message: getAssistantResponseText('clarification.pronoun_multiple_options', language, {}), clarification: { question: getAssistantResponseText('clarification.which_one', language, {}), options: pronounIntent.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' })) } };
      if (isIntent(pronounIntent)) return await this.modules.hooks.executeIntent(pronounIntent, request, language, userId, userName, prompt, memory);
    }

    return null;
  }

  public isClarificationSelectionReply(normalized: string): boolean {
    // 1. Detect fresh high-level intents
    if (this.deps.aliasManagementService.isAliasCreation(normalized)) return false;
    if (isRoomBulkFastPath(normalized)) return false;
    if (isBulkFastPath(normalized)) return false;
    if (isManagementIntent(normalized)) return false;
    if (isLikelyHomeControlPrompt(normalized)) {
      // isLikelyHomeControlPrompt might catch short selection phrases like "la de la sala"
      // we need to be careful. If it's a very short phrase (1-2 words) that matches a common selection pattern, we let it through.
      const selectionPatterns = [
        /^la primera$/i, /^la segunda$/i, /^la tercera$/i, /^la cuarta$/i,
        /^primera$/i, /^segunda$/i, /^tercera$/i, /^cuarta$/i,
        /^esa$/i, /^ese$/i, /^esas$/i, /^esos$/i, /^la de$/i, /^el de$/i,
        /^the first$/i, /^the second$/i, /^the third$/i, /^the fourth$/i,
        /^first$/i, /^second$/i, /^third$/i, /^fourth$/i,
        /^that one$/i, /^this one$/i, /^those$/i, /^them$/i,
        /^la de la (.+)$/i, /^el de la (.+)$/i, /^the one in (.+)$/i
      ];
      if (selectionPatterns.some(p => p.test(normalized))) {
        return true;
      }

      // If it's just 1-2 words and doesn't have a clear verb, it might be a label match (which is handled in converse)
      // or a partial label match. We'll allow it to pass through to resolveSelectionFromMemory
      // unless it's a clear fresh intent (already checked above).
      const words = normalized.split(/\s+/);
      if (words.length <= 3) {
        return true;
      }

      return false;
    }

    // 2. Keyword fallback for other intents (state queries, etc)
    const newIntentKeywords = [
      'estado', 'encendido', 'apagado', 'que', 'qué', 'cuales', 'cuáles', 'donde', 'dónde', 'status', 'where'
    ];

    if (newIntentKeywords.some(kw => containsWord(normalized, kw))) {
      return false;
    }

    if (normalized.includes(' es ')) return false;

    return true;
  }
}
