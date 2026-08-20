import { randomUUID } from 'crypto';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { ConfirmationTicketRepository } from '../domain/repositories/ConfirmationTicketRepository';
import { ConfirmationTicket, ConfirmationTicketCommand } from '../domain/ConfirmationTicket';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { AssistantDraftService } from './AssistantDraftService';
import { AssistantLearningService } from './AssistantLearningService';
import { SmartEntityResolver } from './SmartEntityResolver';
import { AssistantSuggestionService } from './AssistantSuggestionService';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1, isValidCommand } from '../../devices/domain/commands';
import { Scene } from '../../devices/domain/Scene';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import type { Intent, MultiCommandAction, IntentInterpreterPort } from './ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import { AssistantMemoryPort, AssistantMemoryEntity, AssistantMemoryState } from './ports/AssistantMemoryPort';
import { FollowUpResolverPort, ResolvedFollowUp } from './ports/FollowUpResolverPort';
import { AssistantPlannerV2ShadowService } from './AssistantPlannerV2ShadowService';
import { AssistantFastPathResolver } from './AssistantFastPathResolver';
import { JarvisResponseFormatter, type JarvisResponseStyle } from './response/JarvisResponseFormatter';
import {
  applyAssistantResponsePreference,
  ASSISTANT_RESPONSE_PREFERENCE_KEY,
  detectAssistantResponsePreferenceCommand,
  getAssistantResponsePreferenceAcknowledgement,
  isAssistantResponsePreference,
  type AssistantResponsePreference
} from './response/AssistantResponsePreference';
import {
  ASSISTANT_CONVERSATION_TONE_KEY,
  ASSISTANT_PREFERRED_ADDRESS_KEY,
  detectAssistantConversationToneCommand,
  detectAssistantPreferredAddressCommand,
  getAssistantConversationToneAcknowledgement,
  getAssistantPreferredAddressAcknowledgement,
  isAssistantConversationTone,
  normalizeAssistantPreferredAddress
} from './response/AssistantConversationProfile';
import { AssistantQuickResponseService } from './AssistantQuickResponseService';
import { getAssistantResponseText } from './response/AssistantResponseCatalog';
import { extractNezuWakeCommand } from '../../shared/domain/nezuWakePhrases';
import { formatNaturalSpanishTime, getSpanishDayPeriod } from './NaturalDateTimeFormatter';
import { detectAssistantLanguage, detectAssistantLanguageOverride } from './AssistantLanguagePolicy';
import { AssistantAliasManagementService } from './AssistantAliasManagementService';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';
import { ScopeFilter } from './ScopeFilter';
import { PermissionGate } from './PermissionGate';
import { normalizeText as sharedNormalizeText, levenshteinDistance } from './textMatching';

export interface AssistantConversationResponse {
  type: "answer" | "execution" | "clarification" | "error";
  message: string;
  llmAttempted?: boolean;
  execution?: SceneExecutionResult;
  clarification?: {
    question: string;
    options: Array<{
      id: string;
      label: string;
      kind: "device" | "scene" | "alias_target" | "room";
    }>;
    pendingAction?: {
      command?: DeviceCommandV1;
      targetId?: string;
      originalPrompt: string;
    };
  };
  responseStyle?: JarvisResponseStyle;
}

export interface ExecutedCommandResult {
  action: MultiCommandAction;
  deviceName: string;
  result: SceneExecutionResult;
}

export interface AssistantConverseRequest {
  prompt: string;
  userName?: string;
  userId?: string;
  selectedOptionId?: string;
  pendingAction?: {
    command?: DeviceCommandV1;
    targetId?: string;
    originalPrompt: string;
  };
  confirmed?: boolean;
  sourceRoomId?: string;
  interactionMode?: 'chat' | 'voice';
}

export interface RoomAliasResolution {
  rooms: Room[];
  status: 'resolved' | 'not_found' | 'ambiguous';
  candidates?: string[];
}

type SuggestionContext =
  | 'command'
  | 'multi_command'
  | 'scene'
  | 'state_query'
  | 'room_query'
  | 'list_query';

type PendingSuggestion = NonNullable<AssistantMemoryState['pendingSuggestion']>;

// --- TYPE GUARDS ---
function isPendingSuggestion(value: unknown): value is PendingSuggestion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.type === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isIntent(value: unknown): value is Intent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validTypes = ['scene', 'command', 'multi_command', 'explain', 'retry', 'company_info', 'unknown'];
  return typeof v.type === 'string' && validTypes.includes(v.type) && typeof v.prompt === 'string';
}

function isClarificationKind(value: unknown): value is 'device' | 'scene' | 'alias_target' | 'room' {
  return value === 'device' || value === 'scene' || value === 'alias_target' || value === 'room';
}

export class AssistantConversationService {
  constructor(
    private readonly intentInterpreter: IntentInterpreterPort,
    private readonly confirmationPolicy: AssistantConfirmationPolicyPort,
    private readonly sceneExecutionService: SceneExecutionService,
    private readonly deviceCommandDispatcher: DeviceCommandDispatcherPort,
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly smallTalkService: AssistantSmallTalkPort,
    private readonly memoryService: AssistantMemoryPort,
    private readonly followUpResolver: FollowUpResolverPort,
    private readonly draftService: AssistantDraftService,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly learningService: AssistantLearningService,
    private readonly entityResolver: SmartEntityResolver,
    private readonly suggestionService: AssistantSuggestionService,
    private readonly executionRecordRepository: ExecutionRecordRepository,
    private readonly systemVariableService: SystemVariableService,
    private readonly shadowService?: AssistantPlannerV2ShadowService,
    private readonly fastPathResolver: AssistantFastPathResolver = new AssistantFastPathResolver(),
    aliasManagementService?: AssistantAliasManagementService,
    private readonly homeRepository?: HomeRepository,
    private readonly confirmationTicketRepository?: ConfirmationTicketRepository
  ) {
    this.aliasManagementService = aliasManagementService ?? new AssistantAliasManagementService(memoryService, deviceRepository, roomRepository);
    this.permissionGate = new PermissionGate(deviceRepository, roomRepository, sceneRepository, automationRepository, homeRepository);
  }

  private readonly aliasManagementService: AssistantAliasManagementService;
  private readonly permissionGate: PermissionGate;
  private readonly scopeFilter = new ScopeFilter();

  /** Single TTL for confirmation tickets, enforced both here and by the repository query. */
  private static readonly CONFIRMATION_TICKET_TTL_MS = 120_000;

  /**
   * The pre-existing conversational confirmation window for a single pending intent.
   * UI and natural-language confirmations share this exact bound so neither origin can
   * execute a stale intent.
   */
  private static readonly PENDING_INTENT_CONFIRMATION_TTL_MS = 300_000;

  /**
   * Persists a single-use, TTL-bound confirmation ticket for a proposed bulk/multi-device
   * action. No-op if no ConfirmationTicketRepository is wired (legacy/test contexts) —
   * callers degrade gracefully to "propose but never confirmable", never to
   * "execute without confirmation".
   */
  private async createConfirmationTicket(
    userId: string,
    homeId: string,
    command: ConfirmationTicketCommand,
    deviceIds: string[],
    originalPrompt: string,
    bulkType?: 'all' | 'lights'
  ): Promise<void> {
    if (!this.confirmationTicketRepository) return;
    const now = Date.now();
    const ticket: ConfirmationTicket = {
      id: randomUUID(),
      userId,
      homeId,
      command,
      bulkType,
      deviceIds,
      originalPrompt,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + AssistantConversationService.CONFIRMATION_TICKET_TTL_MS).toISOString(),
      consumedAt: null
    };
    await this.confirmationTicketRepository.create(ticket);
  }

  private withJarvisStyle(
    response: AssistantConversationResponse,
    style: JarvisResponseStyle,
    language: string
  ): AssistantConversationResponse {
    const responseStyle = {
      ...style,
      userName: style.userName?.trim() || undefined
    };

    if (language !== 'es' || !responseStyle.userName) {
      return { ...response, responseStyle };
    }

    return {
      ...response,
      message: JarvisResponseFormatter.format(responseStyle),
      responseStyle
    };
  }

  public async converse(request: AssistantConverseRequest, _langHint: string = 'es'): Promise<AssistantConversationResponse> {
    const t0 = Date.now();
    const prompt = request.prompt.trim();
    let activePrompt = prompt;
    const userId = request.userId || 'system';
    let userName = request.userName?.trim() || null;
    const namePrefix = userName ? `${userName}, ` : '';
    const normalized = normalizeAssistantPrompt(prompt);

    // V2: Load Contextual Memory & Aliases FIRST
    const [memory, aliases, storedLangPref, storedResponsePreference, storedPreferredAddress, storedConversationTone] = await Promise.all([
      this.memoryService.getShortTermMemory(userId),
      this.memoryService.getAliases(userId),
      this.memoryService.getUserPreference(userId, 'preferred_language'),
      this.memoryService.getUserPreference(userId, ASSISTANT_RESPONSE_PREFERENCE_KEY)
    ,
      this.memoryService.getUserPreference(userId, ASSISTANT_PREFERRED_ADDRESS_KEY),
      this.memoryService.getUserPreference(userId, ASSISTANT_CONVERSATION_TONE_KEY)
    ]);

    // --- LANGUAGE INTELLIGENCE V1 ---
    const langOverride = detectAssistantLanguageOverride(normalized);
    if (langOverride !== null) {
      await this.memoryService.setUserPreference(userId, 'preferred_language', langOverride);
      return {
        type: 'answer',
        message: getAssistantResponseText('language.updated', langOverride, {})
      };
    }
    const detectedLang = detectAssistantLanguage(prompt);
    const storedValidLang: 'es' | 'en' = storedLangPref === 'en' ? 'en' : (_langHint === 'en' ? 'en' : 'es');
    const language: 'es' | 'en' = detectedLang ?? storedValidLang;
    const responsePreference: AssistantResponsePreference = isAssistantResponsePreference(storedResponsePreference)
      ? storedResponsePreference
      : 'standard';
    this.memoryService.setUserPreference(userId, 'preferred_language', language).catch(() => {});

    const preferredAddress = normalizeAssistantPreferredAddress(storedPreferredAddress);
    userName = userName ?? preferredAddress;
    const requestedAddress = detectAssistantPreferredAddressCommand(prompt);
    if (requestedAddress) {
      await this.memoryService.setUserPreference(userId, ASSISTANT_PREFERRED_ADDRESS_KEY, requestedAddress);
      return { type: 'answer', message: getAssistantPreferredAddressAcknowledgement(requestedAddress, language) };
    }

    const requestedTone = detectAssistantConversationToneCommand(prompt);
    if (requestedTone) {
      await this.memoryService.setUserPreference(userId, ASSISTANT_CONVERSATION_TONE_KEY, requestedTone);
      return { type: 'answer', message: getAssistantConversationToneAcknowledgement(requestedTone, language) };
    }

    const conversationTone = isAssistantConversationTone(storedConversationTone) ? storedConversationTone : 'neutral';

    // --- 1. PENDING CONFIRMATIONS / SELECTED OPTION ---
    // A) Management Confirmation
    if (memory?.pendingManagementAction) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) return this.returnWithShadow(activePrompt, userId, language, await this.executeManagementAction(memory.pendingManagementAction, userId, language));
      if (isNegative) { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }); }
    }

    // B) Alias Delete Confirmation
    if (memory?.pendingAliasDelete) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) { await this.memoryService.deleteAlias(userId, memory.pendingAliasDelete.alias); await this.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('alias.deleted', language, { alias: memory.pendingAliasDelete.alias }) }; }
      if (isNegative) { await this.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }; }
    }

    // C) Bulk Action Confirmation — persisted ticket, single-use, TTL enforced by the
    // repository query itself (no separate in-code timestamp/window to keep in sync).
    if (this.confirmationTicketRepository) {
      const pendingTicket = await this.confirmationTicketRepository.findActiveByUserId(userId);
      if (pendingTicket) {
        if (this.isBulkActionAccept(normalized)) return await this.handleBulkActionAccept(userId, language, pendingTicket);
        if (this.isBulkActionReject(normalized)) return await this.handleBulkActionReject(userId, language, pendingTicket);
      }
    }

    // D) Draft Confirmation
    if (memory?.pendingDraft) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) {
        try { await this.draftService.activateDraft(memory.pendingDraft.id, userId); await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: getAssistantResponseText('draft.activated', language, {}) }); }
        catch (err: unknown) { return this.returnWithShadow(activePrompt, userId, language, { type: 'error', message: getAssistantResponseText('draft.activation_failed', language, {}) }); }
      }
      if (isNegative) { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: getAssistantResponseText('draft.cancelled', language, {}) }); }
    }

    // E) Selected Option Flow (UI clicks)
    if (request.selectedOptionId) {
      if (memory?.source === 'sensor_reading') {
        return await this.handleSensorReadingSelection(userId, request.selectedOptionId, language);
      }
      if (memory?.pendingIntent && (request.selectedOptionId === 'confirm' || request.selectedOptionId === 'cancel')) {
        if (!this.isPendingIntentConfirmationActive(memory.pendingIntent)) {
          await this.clearPendingAction(userId);
          return {
            type: 'answer',
            message: getAssistantResponseText('confirmation.expired', language, {})
          };
        }
        if (request.selectedOptionId === 'confirm') { request.confirmed = true; return this.returnWithShadow(activePrompt, userId, language, await this.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory)); }
        else { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }); }
      }
      return await this.handleSelection(request, language);
    }

    // F) Natural Language Confirmations (Yes/No)
    if (this.isConfirmation(normalized)) {
      if (memory?.pendingIntent) {
        if (this.isPendingIntentConfirmationActive(memory.pendingIntent)) {
          if (this.isPositiveConfirmation(normalized)) { request.confirmed = true; return await this.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory); }
          else if (this.isNegativeConfirmation(normalized)) { await this.clearPendingAction(userId); return { type: 'answer', message: getAssistantResponseText('action.cancelled', language, {}) }; }
        } else {
          await this.clearPendingAction(userId);
          return {
            type: 'answer',
            message: getAssistantResponseText('confirmation.expired', language, {})
          };
        }
      }
      const pendingSuggestion = memory?.pendingSuggestion;
      if (isPendingSuggestion(pendingSuggestion)) {
        if (this.isSuggestionAccept(normalized)) return await this.handleSuggestionAccept(userId, language, pendingSuggestion);
        if (this.isSuggestionReject(normalized)) return await this.handleSuggestionReject(userId, language, pendingSuggestion);
        if (this.isSuggestionPostpone(normalized)) return await this.handleSuggestionPostpone(userId, language, pendingSuggestion);
      }
      if (this.isPositiveConfirmation(normalized)) return { type: 'answer', message: getAssistantResponseText('confirmation.none_pending', language, {}) };
    }

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

        await this.memoryService.saveShortTermMemory(userId, newMemory);
        // Update local memory for the rest of this execution
        memory.clarificationOptions = undefined;
        if (isVagueClarification) {
           memory.pendingIntent = undefined;
           memory.originalPrompt = undefined;
        }
      } else {
        let selectionPrompt = normalized;
        if (normalized.startsWith('y ') || normalized.startsWith('and ')) selectionPrompt = normalized.substring(normalized.startsWith('y ') ? 2 : 4).trim();
        const selectedId = this.resolveSelectionFromMemory(selectionPrompt, memory.clarificationOptions, language);
        if (selectedId) {
          if (memory.source === 'sensor_reading') {
            return await this.handleSensorReadingSelection(userId, selectedId, language);
          }
          const selectedOption = memory.clarificationOptions.find(opt => opt.id === selectedId);
          let command = memory.pendingIntent?.type === 'command' ? memory.pendingIntent.command : undefined;
          if (!command) command = this.inferCommandFromPrompt(memory.originalPrompt || prompt) as DeviceCommandV1 | undefined;
          if (command) { request.pendingAction = { command, targetId: selectedId, originalPrompt: memory.originalPrompt || prompt }; return await this.handleSelection(request, language); }
          else {
            await this.memoryService.saveShortTermMemory(userId, { ...memory, entities: [{ id: selectedId, name: selectedOption?.label || 'Selected', type: 'device', roomId: null }], timestamp: new Date().toISOString() });
            return { type: 'answer', message: getAssistantResponseText('selection.follow_up_selected', language, { label: selectedOption?.label ?? 'Selected' }) };
          }
        }
      }
    }

    // --- PRE-INTENT: PRONOUN RESOLUTION ---
    const pronounIntent = await this.resolvePronounIntent(normalized, memory, language);
    if (pronounIntent) {
      if ('type' in pronounIntent && pronounIntent.type === 'clarificationRequired') return { type: 'clarification', message: getAssistantResponseText('clarification.pronoun_multiple_options', language, {}), clarification: { question: getAssistantResponseText('clarification.which_one', language, {}), options: pronounIntent.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' })) } };
      if (isIntent(pronounIntent)) return await this.executeIntent(pronounIntent, request, language, userId, userName, prompt, memory);
    }

    // Date and time questions must be resolved before generic alias syntax such as "X es Y".
    if (this.isDateTimeQuery(normalized)) return await this.handleDateTimeQuery(normalized, language);

    // --- 3. ALIAS MANAGEMENT ---
    if (this.aliasManagementService.isAliasListQuery(normalized)) return await this.aliasManagementService.handleAliasList(userId, language);
    const meaningAlias = this.aliasManagementService.extractAliasMeaningQuery(normalized);
    if (meaningAlias) return await this.aliasManagementService.handleAliasMeaning(userId, meaningAlias, language);
    const deleteAliasReq = this.aliasManagementService.extractAliasDeleteRequest(normalized);
    if (deleteAliasReq) return await this.aliasManagementService.handleAliasDeleteRequest(userId, deleteAliasReq, language, memory);
    if (this.aliasManagementService.isAliasCreation(normalized)) return await this.aliasManagementService.handleAliasCreation(normalized, userId, language);

    activePrompt = normalized;

    // --- 4. ROOM CATEGORY FAST-PATHS ---
    // A room-qualified cover command must pass through the normal confirmation
    // policy before the generic device-name fast path can resolve it.
    const roomCover = this.isRoomCoverFastPath(normalized);
    if (roomCover) {
      const roomCoverResponse = await this.handleRoomCoverFastPath(userId, roomCover.command, roomCover.roomName, language, prompt, aliases, userName, request);
      if (roomCoverResponse) return roomCoverResponse;
    }

    // --- 5. EXACT/STRONG FAST-PATH ---
    const fastPathResponse = await this.attemptFastPathExecution(activePrompt, userId, language, userName);
    if (fastPathResponse) return fastPathResponse;

    const roomSingular = this.isRoomSingularLightFastPath(normalized);
    if (roomSingular) {
      const singularResponse = await this.handleRoomSingularLightFastPath(userId, roomSingular.command, roomSingular.roomName, language, prompt, aliases);
      if (singularResponse) return singularResponse;
    }

    const roomBulk = this.isRoomBulkFastPath(normalized);
    if (roomBulk) return await this.handleRoomBulkFastPath(userId, roomBulk.command, roomBulk.roomName, roomBulk.bulkType, language, aliases);

    // --- 6. GLOBAL BULK FAST-PATH ---
    const globalBulk = this.isBulkFastPath(normalized);
    if (globalBulk) { const bulkResponse = await this.handleBulkFastPath(normalized, globalBulk.bulkType, globalBulk.command, language, userId, request.interactionMode); if (bulkResponse) return bulkResponse; }

    // --- 7. DEVICE ALIAS FAST-PATH ---
    const deviceAliasFastPath = await this.attemptDeviceAliasFastPathExecution(activePrompt, userId, language, aliases);
    if (deviceAliasFastPath) return deviceAliasFastPath;

    // --- DETERMINISTIC GENERAL ROUTES ---
    if (this.isHomeSummaryQuery(normalized)) return await this.handleHomeSummary(language, userId);
    if (this.isAttentionQuery(normalized)) return await this.handleAttentionQuery(language, userId);
    if (this.isRecentActivityQuery(normalized)) return await this.handleRecentActivity(language);
    if (this.isConversationContextQuery(normalized)) return this.handleConversationContext(memory, language);
    if (this.isGreeting(normalized)) return AssistantQuickResponseService.format('greeting', language, userName);
    if (this.isWellnessQuery(normalized)) return AssistantQuickResponseService.format('wellness', language, userName);
    if (this.isNameQuery(normalized)) return AssistantQuickResponseService.format('name', language, userName);
    if (this.isCompanyQuery(normalized)) return this.handleCompanyInfoQuery(language);
    if (this.isHelpQuery(normalized) || this.isPresentation(normalized) || this.isScopeQuery(normalized)) return await this.handleCapabilitiesGuide(userId, language);

    // --- 8. CONTEXT ROOM FAST-PATH ---
    const contextRoomFastPath = await this.attemptContextRoomFastPathExecution(activePrompt, request.sourceRoomId, userId, userName, language, aliases);
    if (contextRoomFastPath) return contextRoomFastPath;

    // --- 9. SAFETY GATE V2 ---
    const safetyResult = await this.applySafetyGateV2(activePrompt, userId, language, request);
    if (safetyResult) return safetyResult;

    // --- 10. FOLLOW-UP RESOLVER ---
    activePrompt = prompt;
    let followUp: ResolvedFollowUp = { resolvedPrompt: prompt, handled: false, referencesMemory: false };
    followUp = this.followUpResolver.resolve(prompt, memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }, language, aliases);
    if (followUp.handled && followUp.response) return { type: 'answer', message: followUp.response };
    activePrompt = followUp.resolvedPrompt;

    // --- 11. PLANNER V2 / V1 FALLBACK ---
    const resolvedNormalized = normalizeAssistantPrompt(activePrompt);
    if (this.isEquivalenceQuery(resolvedNormalized)) return this.handleEquivalenceQuery(language);
    if (this.isRoomQuery(resolvedNormalized)) return await this.handleRoomQuery(language, userId);
    if (this.isDraftCreation(resolvedNormalized)) return await this.handleDraftCreation(resolvedNormalized, language, userId);
    if (this.isSensorReadingQuery(resolvedNormalized)) return await this.handleSensorReadingQuery(resolvedNormalized, language, userId);
    if (this.isPointStateQuery(resolvedNormalized)) return await this.handlePointStateQuery(resolvedNormalized, language, userId);
    if (this.isStateQuery(resolvedNormalized)) return await this.handleStateQuery(resolvedNormalized, language, userName, userId, followUp.referencesMemory ? memory?.entities : undefined, request.sourceRoomId);
    if (this.isManagementIntent(resolvedNormalized)) return await this.handleManagementIntent(resolvedNormalized, userId, language);
    if (this.isListScenesIntent(resolvedNormalized)) return await this.handleListScenes(language, userId);
    if (this.isListAutomationsIntent(resolvedNormalized)) return await this.handleListAutomations(language, userId);
    if (this.isDetailFollowUp(resolvedNormalized) && memory?.lastQueryType === 'state_devices' && memory.entities && memory.entities.length > 0) return await this.handleDetailFollowUp(memory, language, userId);

    const responsePreferenceOverride = detectAssistantResponsePreferenceCommand(resolvedNormalized);
    if (responsePreferenceOverride && !this.isLikelyHomeControlPrompt(resolvedNormalized)) {
      await this.memoryService.setUserPreference(
        userId,
        ASSISTANT_RESPONSE_PREFERENCE_KEY,
        responsePreferenceOverride
      );
      return {
        type: 'answer',
        message: getAssistantResponsePreferenceAcknowledgement(responsePreferenceOverride, language)
      };
    }

    if (!this.isLikelyHomeControlPrompt(resolvedNormalized)) {
      const conversationalResponse = await this.smallTalkService.handle(activePrompt, language, userName, userId);
      if (conversationTone !== 'neutral') {
        const prefix = conversationTone === 'warm'
          ? (language === 'en' ? 'Of course. ' : 'Con gusto. ')
          : (language === 'en' ? 'Understood. ' : 'Entendido. ');
        conversationalResponse.message = `${prefix}${conversationalResponse.message}`;
      }
      const { llmAttempted, ...conversationResponse } = conversationalResponse;
      return this.returnWithShadow(activePrompt, userId, language, conversationResponse, responsePreference, true, !llmAttempted);
    }

    const v2Response = await this.attemptV2HybridExecution(activePrompt, userId, language, userName, memory);
    if (v2Response) return this.returnWithShadow(activePrompt, userId, language, v2Response);

    const intentResult = await this.intentInterpreter.interpret(activePrompt, userId);
    if (intentResult && 'type' in intentResult) {
      if (intentResult.type === 'failure') return { type: 'error', message: intentResult.message };
      if (intentResult.type === 'clarificationRequired') {
        const inferredCommand = this.inferCommandFromPrompt(intentResult.originalSegment) || this.inferCommandFromPrompt(activePrompt) || 'turn_on';
        await this.memoryService.saveShortTermMemory(userId, { lastQueryType: 'clarification', entities: [], timestamp: new Date().toISOString(), clarificationOptions: intentResult.options, originalPrompt: activePrompt, pendingIntent: { type: 'command', deviceId: '', command: inferredCommand as DeviceCommandV1, prompt: activePrompt, timestamp: new Date().toISOString() } });
        const options = intentResult.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' }));
        return this.returnWithShadow(activePrompt, userId, language, this.withJarvisStyle({ type: 'clarification', message: getAssistantResponseText('clarification.intent_multiple_matches', language, { segment: intentResult.originalSegment }), clarification: { question: getAssistantResponseText('clarification.which_one_do_you_mean', language, {}), options } }, {
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

    if (intent && intent.type !== 'unknown' && (memory?.pendingIntent || memory?.pendingDraft)) await this.clearPendingAction(userId);
    return this.returnWithShadow(activePrompt, userId, language, await this.executeIntent(intent || { type: 'unknown', prompt: activePrompt }, request, language, userId, userName, activePrompt, memory));
  }

  private async executeIntent(
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
      if (this.isLikelyHomeControlPrompt(normalizeAssistantPrompt(prompt))) {
        return {
          type: 'answer',
          message: getAssistantResponseText('command.not_understood', language, {})
        };
      }

      return this.smallTalkService.handle(prompt, language, userName, userId);
    }

    // Check for ambiguity (deterministic V1 only for now)
    if (intent.type === 'command') {
      // 1. Room-specific command?
      if (intent.roomId && !intent.deviceId) {
        if (intent.command === 'turn_on' || intent.command === 'turn_off') {
          return await this.handleRoomSelectionForLight(intent.roomId, intent.command, userId, language, prompt, correlationId);
        }
      }

      const allMatches = await this.findMatchingDevices(prompt, userId);

      if (!intent.deviceId && allMatches.length === 0) {
        const targetPhrase = this.extractTargetPhrase(prompt);
        const allDevices = await this.permissionGate.getAuthorizedDevices(userId);
        const fuzzyResult = this.findFuzzyCandidateSuggestions(targetPhrase, allDevices, language, intent.command, prompt);

        if (fuzzyResult) {
          // If we have a fuzzy clarification, save it to memory
          if (fuzzyResult.type === 'clarification' && fuzzyResult.clarification) {
            await this.memoryService.saveShortTermMemory(userId, {
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

        return this.withJarvisStyle({
          type: 'answer',
          message: getAssistantResponseText('resolution.device_not_found', language, { targetPhrase })
        }, {
          status: 'not_found',
          searched: targetPhrase,
          userName: userName || undefined
        }, language);
      }

      if (allMatches.length > 1) {
        const targetPhrase = this.extractTargetPhrase(prompt);
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

        await this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'clarification',
          entities: allMatches.map(d => ({ id: d.id, name: d.name, type: d.type, roomId: d.roomId })),
          timestamp: new Date().toISOString(),
          clarificationOptions: options,
          pendingIntent: { ...intent, timestamp: new Date().toISOString() },
          originalPrompt: prompt
        });

      return this.withJarvisStyle({
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
        this.memoryService.saveShortTermMemory(userId, {
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
    const t_policy = Date.now();
    const preview = await this.confirmationPolicy.evaluate(intent, language);
    if (preview.requiresConfirmation && request.confirmed !== true) {
      // Save pending intent to memory
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: intent.type === 'command' ? [{ id: intent.deviceId, name: 'Target', type: 'device', roomId: null }] : [],
        timestamp: new Date().toISOString(),
        pendingIntent: { ...intent, timestamp: new Date().toISOString() },
        originalPrompt: prompt
      });

      return this.withJarvisStyle({
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
      const scene = await this.sceneRepository.findSceneById(intent.target);
      if (!scene) return { type: 'error', message: getAssistantResponseText('scene.not_found', language, {}) };

      await this.permissionGate.assertHomeAuthorized(userId, scene.homeId);

      const result = await this.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });

      // Clear pending confirmation if successful
      await this.clearPendingAction(userId);

      // Record learning event
      this.learningService.recordSceneUsed(userId, scene, prompt).catch(() => {});

      return await this.attachSuggestionIfNeeded({
        type: 'execution',
        message: getAssistantResponseText('scene.execution_started', language, {}),
        execution: result
      }, userId, language, memory, 'scene');
    }

    if (intent.type === 'command') {
      const preview = await this.confirmationPolicy.evaluate(intent, language);
      if (preview.requiresConfirmation && !request.confirmed) {
        const device = await this.deviceRepository.findDeviceById(intent.deviceId);
        const deviceName = device?.name ?? intent.deviceId;
        await this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'confirmation',
          entities: device ? [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }] : [],
          timestamp: new Date().toISOString(),
          pendingIntent: { ...intent, timestamp: new Date().toISOString() },
          originalPrompt: prompt
        });
        return this.withJarvisStyle({
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
        const device = await this.deviceRepository.findDeviceById(intent.deviceId);
        const deviceName = device?.name ?? intent.deviceId;
        const result = await this.executeAuthorizedCommand(userId, intent.deviceId, intent.command, intent.prompt, correlationId, intent.params);

        if (result.status === 'failed') {
          this.learningService.recordCommandResult(userId, intent.deviceId, false, result.actions[0]?.error || 'Unknown error').catch(() => {});
          return this.withJarvisStyle({
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
        await this.clearPendingAction(userId);

        // Record learning event
        if (device) {
          this.learningService.recordDeviceUsed(userId, device, prompt).catch(() => {});
        }
        this.learningService.recordCommandResult(userId, intent.deviceId, true).catch(() => {});

        // V2: Save to memory
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities: [{ id: intent.deviceId, name: deviceName, type: 'device', roomId: device?.roomId || null }],
          timestamp: new Date().toISOString()
        }).catch(() => {});

        return await this.attachSuggestionIfNeeded(this.withJarvisStyle({
          type: 'execution',
          message: this.buildCommandSuccessMessage(intent.command, deviceName, userName, language),
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

    if (intent.type === 'multi_command') {
      const preview = await this.confirmationPolicy.evaluate(intent, language);
      if (preview.requiresConfirmation && !request.confirmed) {
        await this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'confirmation',
          entities: [],
          timestamp: new Date().toISOString(),
          pendingIntent: { ...intent, timestamp: new Date().toISOString() },
          originalPrompt: prompt
        });
        const actionSummary = intent.actions.slice(0, 3).map(a => a.targetName ?? a.deviceId).join(', ');
        const confirmMsg = getAssistantResponseText('confirmation.multi_action', language, { count: intent.actions.length, actionSummary });
        return this.withJarvisStyle({
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
          const device = await this.deviceRepository.findDeviceById(action.deviceId);
          const deviceName = device?.name ?? action.targetName ?? action.deviceId;
          const result = await this.executeAuthorizedCommand(userId, action.deviceId, action.command, intent.prompt, correlationId, action.params);
          results.push({ action, deviceName, result });
          if (device) {
            entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
          }
        }

        const successes = results.filter(r => r.result.status === 'success');
        const failures = results.filter(r => r.result.status === 'failed');

        const message = this.formatMultiCommandSummary(results, language);

        await this.clearPendingAction(userId);
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities,
          timestamp: new Date().toISOString()
        }).catch(() => {});

        return await this.attachSuggestionIfNeeded({
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

    if (intent.type === 'explain') {
      return await this.handleExplainQuery(intent.targetId, language);
    }

    if (intent.type === 'retry') {
      return await this.handleRetryQuery(request, userId, language);
    }

    return {
      type: 'error',
      message: getAssistantResponseText('intent.not_recognized', language, {})
    };
  }

  private async clearPendingAction(userId: string): Promise<void> {
    const memory = await this.memoryService.getShortTermMemory(userId);
    if (memory) {
      await this.memoryService.saveShortTermMemory(userId, {
        ...memory,
        pendingIntent: undefined,
        clarificationOptions: undefined,
        pendingDraft: undefined,
        pendingManagementAction: undefined,
        pendingSuggestion: undefined,
        pendingAliasDelete: undefined,
        originalPrompt: undefined
      });
    }
  }

  private isPendingIntentConfirmationActive(pendingIntent: NonNullable<AssistantMemoryState['pendingIntent']>): boolean {
    const pendingAt = new Date(pendingIntent.timestamp).getTime();
    if (!Number.isFinite(pendingAt)) return false;

    const elapsed = Date.now() - pendingAt;
    return elapsed >= 0 && elapsed < AssistantConversationService.PENDING_INTENT_CONFIRMATION_TTL_MS;
  }

  private isConfirmation(normalized: string): boolean {
    const triggers = [
      'si', 'dale', 'confirmo', 'adelante', 'procede', 'ok', 'vale', 'confirmar', 'ejecutar',
      'yes', 'go ahead', 'confirm', 'proceed', 'execute', 'do it', 'sure',
      'no', 'cancela', 'cancelar', 'abortar', 'noup', 'negativo',
      'cancel', 'abort', 'nope', 'negative'
    ];
    return triggers.some(t => normalized === t || normalized.startsWith(t + ' '));
  }

  private isPositiveConfirmation(normalized: string): boolean {
    const positives = [
      'si', 'dale', 'confirmo', 'adelante', 'procede', 'ok', 'vale', 'confirmar', 'ejecutar',
      'yes', 'go ahead', 'confirm', 'proceed', 'execute', 'do it', 'sure'
    ];
    return positives.some(t => normalized === t || normalized.startsWith(t + ' '));
  }

  private isNegativeConfirmation(normalized: string): boolean {
    const negatives = [
      'no', 'cancela', 'cancelar', 'abortar', 'noup', 'negativo',
      'cancel', 'abort', 'nope', 'negative'
    ];
    return negatives.some(t => normalized === t || normalized.startsWith(t + ' '));
  }

  private resolveSelectionFromMemory(text: string, options: { id: string; label: string }[], language: string): string | null {
    let normalized = normalizeAssistantPrompt(text);
    if (normalized.startsWith('seleccione ')) normalized = normalized.replace('seleccione ', '').trim();
    if (normalized.startsWith('selected ')) normalized = normalized.replace('selected ', '').trim();

    // Check exact ID match first
    const exactId = options.find(opt => opt.id === text);
    if (exactId) return exactId.id;

    // Check indices
    const indexTriggers = [
      { triggers: ['la primera', 'el primero', 'primera', 'primero', 'the first', 'first one', '1st', 'primera'], index: 0 },
      { triggers: ['la segunda', 'el segundo', 'segunda', 'segundo', 'the second', 'second one', '2nd'], index: 1 },
      { triggers: ['la tercera', 'el tercero', 'tercera', 'tercero', 'the third', 'third one', '3rd'], index: 2 },
    ];

    for (const group of indexTriggers) {
      if (group.triggers.some(t => normalized === t || normalized.includes(t))) {
        if (options[group.index]) return options[group.index].id;
      }
    }

    // Exact candidate label match
    const exactLabel = options.find(opt => normalizeAssistantPrompt(opt.label) === normalized);
    if (exactLabel) return exactLabel.id;

    // Partial label match (e.g. "luz sala")
    const partialLabel = options.find(opt => {
      const optLabel = normalizeAssistantPrompt(opt.label);
      return normalized.includes(optLabel) || optLabel.includes(normalized);
    });
    if (partialLabel) return partialLabel.id;

    return null;
  }
  private inferCommandFromPrompt(prompt: string): DeviceCommandV1 | undefined {
    const normalized = normalizeAssistantPrompt(prompt);
    // Explicit keywords
    if (normalized.includes('cierra') || normalized.includes('cerrar') || normalized.includes('close')) return 'close';
    if (normalized.includes('abre') || normalized.includes('abrir') || normalized.includes('open')) return 'open';
    if (normalized.includes('apaga') || normalized.includes('off')) return 'turn_off';
    if (normalized.includes('enciende') || normalized.includes('prende') || normalized.includes('on')) return 'turn_on';

    // English phrases
    if (normalized.includes('turn off')) return 'turn_off';
    if (normalized.includes('turn on')) return 'turn_on';

    return undefined;
  }

  private isEquivalenceQuery(normalized: string): boolean {
    const triggersES = [
      'es lo mismo que decir', 'es igual a decir', 'es lo mismo que', 'es igual a',
      'quiere decir lo mismo', 'significa lo mismo', 'igual que', 'lo mismo que'
    ];
    const wordsES = ['cuarto', 'estancia', 'habitacion', 'zona', 'room', 'area', 'espacio'];

    const triggersEN = [
      'is the same as', 'is equal to', 'means the same as', 'is it the same',
      'the same as', 'same as', 'equivalent to'
    ];
    const wordsEN = ['room', 'area', 'space', 'zone', 'chamber', 'quarter'];

    const hasTrigger = triggersES.some(t => normalized.includes(t)) || triggersEN.some(t => normalized.includes(t));
    const hasWord = wordsES.some(w => normalized.includes(w)) || wordsEN.some(w => normalized.includes(w));

    return hasTrigger && hasWord;
  }

  private handleEquivalenceQuery(language: string): AssistantConversationResponse {
    return {
      type: 'answer',
      message: language === 'en'
        ? 'Yes. In HomePilot, I can resolve rooms by their name or the aliases you define in your settings. I’ll treat them as references to where your devices are located.'
        : 'Sí, en HomePilot puedo resolver estancias por su nombre o por los alias que definas en tu configuración. Los usaré como referencias al espacio donde están tus dispositivos.'
    };
  }

  private isDraftCreation(normalized: string): boolean {
    const triggers = [
      'crea una escena', 'crear escena', 'crea un modo', 'crear modo', 'haz una escena', 'prepara una escena',
      'crea una rutina', 'crear rutina', 'haz una rutina',
      'create scene', 'create routine', 'make a scene', 'make a routine', 'prepare a scene'
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private async handleDraftCreation(normalized: string, language: string, userId: string = 'system'): Promise<AssistantConversationResponse> {
    try {
      const isScene = normalized.includes('escena') || normalized.includes('scene');
      const [devices, allRooms] = await Promise.all([
        this.permissionGate.getAuthorizedDevices(userId),
        this.permissionGate.getAuthorizedRooms(userId)
      ]);

      // --- Room matching ---
      let selectedRoom: Room | null = null;
      const aliases = await this.memoryService.getAliases(userId);
      const resolution = this.resolveRoomAlias(normalized, allRooms, devices, userId, aliases);
      if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
        selectedRoom = resolution.rooms[0];
      }

      // --- Infer command ---
      const command = this.inferCommandFromPrompt(normalized) || 'turn_off';

      // --- Room not found ---
      if (!selectedRoom) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find the room specified. You can ask me "what rooms do you know".`
            : `No encontré la estancia especificada. Puedes preguntarme "qué estancias conoces".`
        };
      }

      // --- Filter: devices in this room (strict roomId equality, null-safe) ---
      const roomDevices = devices.filter((d: Device) => d.roomId != null && d.roomId === selectedRoom!.id);

      if (roomDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I found the room "${selectedRoom.name}", but no devices are assigned to it.`
            : `Encontré la estancia "${selectedRoom.name}", pero ningún dispositivo está asignado a ella.`
        };
      }

      // --- Filter: controllable devices ---
      const controllableDevices = roomDevices.filter((d: Device) => this.scopeFilter.isControllableDevice(d, command));

      if (controllableDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I found devices in "${selectedRoom.name}", but none of them are controllable (lights, switches, or outlets).`
            : `Encontré dispositivos en "${selectedRoom.name}", pero ninguno es controlable (luces, interruptores o enchufes).`
        };
      }

      // --- Build draft ---
      const draftName = language === 'en'
        ? `${command === 'turn_on' ? 'Turn on' : 'Turn off'} ${selectedRoom.name}`
        : `${command === 'turn_on' ? 'Encender' : 'Apagar'} ${selectedRoom.name}`;

      const fingerprint = `draft:${userId}:${normalized}:${selectedRoom.id}`;
      const homeId = selectedRoom.homeId || controllableDevices[0]?.homeId;

      if (!homeId) {
        return {
          type: 'answer',
          message: language === 'en'
            ? "I couldn't determine the home to create the draft."
            : "No pude determinar el hogar para crear el borrador."
        };
      }

      let draftId = '';
      if (isScene) {
        const actions = controllableDevices.map((d: Device) => ({
          deviceId: d.id,
          command: { name: command, params: {} }
        }));
        const draft = await this.draftService.createSceneDraft(homeId, selectedRoom.id, draftName, actions, fingerprint);
        draftId = draft.id;
      } else {
        const draft = await this.draftService.createAutomationDraft(
          homeId, draftName,
          { type: 'time', value: '22:00' },
          { devices: controllableDevices.map((d: Device) => d.id), command },
          fingerprint
        );
        draftId = draft.id;
      }

      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'draft_creation',
        entities: controllableDevices.map((d: Device) => ({ id: d.id, name: d.name, type: d.type, roomId: d.roomId })),
        timestamp: new Date().toISOString(),
        pendingDraft: {
          id: draftId,
          type: isScene ? 'scene' : 'automation',
          originalPrompt: normalized
        }
      });

      return {
        type: 'clarification',
        message: language === 'en'
          ? `Oscar, I've prepared a draft ${isScene ? 'scene' : 'routine'} to ${command === 'turn_on' ? 'turn on' : 'turn off'} ${controllableDevices.length} devices in ${selectedRoom.name}. Do you want to activate it now?`
          : `Oscar, he preparado un borrador de ${isScene ? 'escena' : 'rutina'} para ${command === 'turn_on' ? 'encender' : 'apagar'} ${controllableDevices.length} dispositivos en ${selectedRoom.name}. ¿Quieres activarlo ahora?`,
        clarification: {
          question: language === 'en' ? 'Do you want to activate it?' : '¿Quieres activarlo?',
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes, activate' : 'Sí, activar', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No, cancel' : 'No, cancelar', kind: 'scene' }
          ]
        }
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AssistantConversation] Error in handleDraftCreation:', error);
      }
      return {
        type: 'answer',
        message: language === 'en'
          ? 'I couldn\'t prepare the scene draft. Make sure there are controllable devices in that room.'
          : 'No pude preparar el borrador de escena. Revisa que existan dispositivos en esa estancia.'
      };
    }
  }

  /**
   * Determines if a device supports the given command.
   * Uses a type-based check as primary filter, then validates via domain capabilities.
   * The type-based check runs first to handle HA devices or devices without explicit capabilities.
   */
  private isRoomQuery(normalized: string): boolean {
    const triggers = [
      "que estancias conoces", "que estancia conoces", "que estancia nomas conoces",
      "que cuartos conoces", "que habitaciones tienes", "que zonas conoces",
      "what rooms do you know", "what areas do you know", "list rooms"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private async handleRoomQuery(language: string, userId: string): Promise<AssistantConversationResponse> {
    const rooms = await this.permissionGate.getAuthorizedRooms(userId);
    if (rooms.length === 0) {
      return {
        type: 'answer',
        message: language === 'en' ? "I don't know any rooms yet." : "Aún no conozco ninguna estancia."
      };
    }

    const roomList = rooms.map((r: Room) => `• ${r.name}`).join('\n');
    return {
      type: 'answer',
      message: language === 'en'
        ? `I know these rooms:\n${roomList}`
        : `Conozco estas estancias:\n${roomList}`
    };
  }

  private async handleSelection(request: AssistantConverseRequest, language: string): Promise<AssistantConversationResponse> {
    const userId = request.userId || 'system';
    const memory = await this.memoryService.getShortTermMemory(userId);
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
      const resolvedId = this.resolveSelectionFromMemory(rawTargetId, memory.clarificationOptions, language);
      if (resolvedId) {
        targetId = resolvedId;
        const selectedOption = memory.clarificationOptions.find(opt => opt.id === targetId);

        // --- SAFETY GATE V2: ROOM SELECTION RESOLUTION ---
        if (selectedOption?.kind === 'room') {
          let command = request.pendingAction?.command;
          if (!command && memory.pendingIntent?.type === 'command') command = memory.pendingIntent.command;
          if (!command) command = this.inferCommandFromPrompt(memory.originalPrompt || request.prompt) as DeviceCommandV1 | undefined;

          if (command) {
            return await this.handleRoomSelectionForLight(targetId, command, userId, language, memory.originalPrompt || request.prompt, correlationId);
          }
        }
      }
    }

    // Check if it's a scene or device
    const scene = await this.sceneRepository.findSceneById(targetId);
    if (scene) {
      this.learningService.recordClarificationSelected(userId, scene.id, scene.name, 'scene', request.pendingAction?.originalPrompt || '').catch(() => {});
      await this.permissionGate.assertHomeAuthorized(userId, scene.homeId);
      const result = await this.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });

      if (result.status === 'success') {
        await this.clearPendingAction(userId);
        await this.memoryService.saveShortTermMemory(userId, {
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
      command = this.inferCommandFromPrompt(originalPrompt) as DeviceCommandV1 | undefined;
    }

    if (!command) {
      const room = await this.roomRepository.findRoomById(targetId);
      if (room) {
        return await this.handleStateQuery(originalPrompt, language, request.userName || null, userId, undefined, targetId);
      }
    }

    if (command) {
      const device = await this.deviceRepository.findDeviceById(targetId);
      const deviceName = device?.name ?? targetId;

      if (device) {
        this.learningService.recordClarificationSelected(userId, device.id, device.name, 'device', originalPrompt).catch(() => {});
      }

      const result = await this.executeAuthorizedCommand(userId, targetId, command, originalPrompt, correlationId);

      if (result.status === 'success') {
        await this.clearPendingAction(userId);
        await this.memoryService.saveShortTermMemory(userId, {
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

      return await this.attachSuggestionIfNeeded(this.withJarvisStyle({
        type: 'execution',
        message: result.status === 'success'
          ? this.buildCommandSuccessMessage(command, deviceName, request.userName || null, language)
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

  private isNameQuery(normalized: string): boolean {
    const triggers = [
      "como te llamas", "cómo te llamas", "cuál es tu nombre", "cual es tu nombre",
      "what is your name", "whats your name"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isHelpQuery(normalized: string): boolean {
    const triggers = [
      "ayuda", "help",
      "ayudame", "necesito ayuda",
      "guia", "guiame",
      "como uso esto", "como se usa esto", "como puedo usar esto"
    ];
    return triggers.some(t => normalized === t || normalized.startsWith(t + " ") || normalized.includes(t));
  }

  private isPresentation(normalized: string): boolean {
    const triggers = [
      "quién eres", "quien eres", "who are you",
      "qué puedes hacer", "que puedes hacer", "preséntate", "presentate",
      "que haces", "para que sirves",
      "que sabes hacer", "que puedes controlar",
      "que comandos entiendes", "que ordenes entiendes",
      "que puedo pedirte", "que te puedo pedir",
      "como me ayudas con la casa", "como puedes ayudarme con la casa",
      "what can you do", "what do you do", "what can you control",
      "what commands do you understand", "how can you help me with the house",
      "introduce yourself"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isScopeQuery(normalized: string): boolean {
    const triggers = [
      "que puedo preguntarte", "qué puedo preguntarte", "que cosas puedo preguntar",
      "que cosas puedo decirte", "que puedo decirte",
      "como debo hablarte", "como te puedo hablar",
      "puedo preguntarte cualquier cosa", "te puedo preguntar cualquier cosa",
      "cuales son tus limites", "cuáles son tus límites", "que limites tienes", "qué límites tienes",
      "que no puedes hacer", "qué no puedes hacer",
      "what can i ask you", "can i ask you anything", "what are your limits",
      "what cant you do", "what can't you do"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private async handleCapabilitiesGuide(userId: string, language: string): Promise<AssistantConversationResponse> {
    const [devices, rooms, scenes, automations, aliases] = await Promise.all([
      this.permissionGate.getAuthorizedDevices(userId),
      this.permissionGate.getAuthorizedRooms(userId),
      this.permissionGate.getAuthorizedScenes(userId),
      this.permissionGate.getAuthorizedAutomations(userId),
      this.memoryService.getAliases(userId)
    ]);

    const controllableDevices = devices.filter((device: Device) => (
      this.scopeFilter.isControllableDevice(device, 'turn_on') ||
      this.scopeFilter.isControllableDevice(device, 'turn_off') ||
      this.scopeFilter.isControllableDevice(device, 'toggle')
    ));
    const roomNames = rooms.slice(0, 5).map((room: Room) => room.name);
    const sceneNames = scenes.slice(0, 5).map((scene: Scene) => scene.name);
    const aliasNames = Object.keys(aliases).slice(0, 5);

    const esLines = [
      "Soy HomePilot, tu operador residencial local. Estoy para ayudarte a consultar, controlar y organizar la casa con órdenes naturales.",
      "",
      "Puedes pedirme:",
      "• Estado general: \"qué está encendido\", \"qué luces están encendidas\", \"cómo está la casa\".",
      "• Control por estancia: \"apaga la luz de la sala\", \"enciende el escritorio\", \"cierra la cortina del cuarto master\".",
      "• Acciones masivas seguras: \"apaga todo\", \"apaga todas las luces\", \"cierra todas las cortinas\". Te pediré confirmación cuando corresponda.",
      "• Escenas: \"activa escena cine\", \"apaga cuarto master\", \"crea una escena para apagar la sala\".",
      "• Automatizaciones: \"qué automatizaciones tengo\", \"desactiva la rutina de noche\", \"por qué no se ejecutó\".",
      "• Alias y lenguaje personal: \"llama mi cuarto a Cuarto Master\", \"qué aliases tengo\", \"elimina el alias mi cuarto\".",
      "• Seguimiento: \"la primera\", \"esa\", \"sí\", \"no\", \"dame detalles\", \"reintenta la última acción\".",
      "• Voz: puedes invocarme con el activador local, interrumpirme mientras hablo y dictar una nueva orden.",
      "",
      "Límites:",
      "• No soy un buscador general ni respondo temas fuera del hogar.",
      "• Solo puedo operar dispositivos, estancias, escenas, automatizaciones y alias registrados en HomePilot.",
      "• Si una orden es ambigua o masiva, te pediré elegir o confirmar antes de ejecutar."
    ];

    const enLines = [
      "I am HomePilot, your local residential operator. I help you inspect, control, and organize the home with natural commands.",
      "",
      "You can ask me:",
      "• General status: \"what is on\", \"what lights are on\", \"how is the house\".",
      "• Room control: \"turn off the living room light\", \"turn on the desk\", \"close the master bedroom curtain\".",
      "• Safe bulk actions: \"turn everything off\", \"turn off all lights\", \"close all curtains\". I will ask for confirmation when needed.",
      "• Scenes: \"activate cinema scene\", \"turn off master bedroom\", \"create a scene to turn off the living room\".",
      "• Automations: \"what automations do I have\", \"disable night routine\", \"why did it not run\".",
      "• Aliases and personal language: \"call master my room\", \"what aliases do I have\", \"delete my room alias\".",
      "• Follow-ups: \"the first one\", \"that one\", \"yes\", \"no\", \"show details\", \"retry the last action\".",
      "• Voice: you can wake me locally, interrupt me while I am speaking, and dictate a new command.",
      "",
      "Limits:",
      "• I am not a general search assistant and I avoid topics outside the home.",
      "• I can only operate devices, rooms, scenes, automations, and aliases registered in HomePilot.",
      "• If a command is ambiguous or bulk-level, I will ask you to choose or confirm before executing."
    ];

    const lines = language === 'en' ? enLines : esLines;
    const inventoryLabel = language === 'en' ? "Current HomePilot context:" : "Contexto actual de HomePilot:";
    const roomsLabel = language === 'en' ? "rooms" : "estancias";
    const devicesLabel = language === 'en' ? "controllable devices" : "dispositivos controlables";
    const scenesLabel = language === 'en' ? "scenes" : "escenas";
    const automationsLabel = language === 'en' ? "automations" : "automatizaciones";
    const aliasesLabel = language === 'en' ? "aliases" : "aliases";
    const examplesLabel = language === 'en' ? "Examples available now" : "Ejemplos disponibles ahora";
    const noneLabel = language === 'en' ? "none yet" : "ninguno todavía";

    lines.push(
      "",
      `${inventoryLabel} ${rooms.length} ${roomsLabel}, ${controllableDevices.length} ${devicesLabel}, ${scenes.length} ${scenesLabel}, ${automations.length} ${automationsLabel}, ${Object.keys(aliases).length} ${aliasesLabel}.`
    );

    const examples: string[] = [];
    if (roomNames.length > 0) examples.push(`${roomsLabel}: ${roomNames.join(', ')}`);
    if (sceneNames.length > 0) examples.push(`${scenesLabel}: ${sceneNames.join(', ')}`);
    if (aliasNames.length > 0) examples.push(`${aliasesLabel}: ${aliasNames.join(', ')}`);

    lines.push(`${examplesLabel}: ${examples.length > 0 ? examples.join(' | ') : noneLabel}.`);

    return {
      type: 'answer',
      message: lines.join('\n')
    };
  }

  private isDateTimeQuery(normalized: string): boolean {
    const triggers = [
      "que fecha es hoy", "cual es la fecha", "dime la fecha", "que dia es hoy", "en que dia estamos",
      "que hora es", "dime la hora", "me dices la hora", "puedes decirme la hora", "tienes la hora",
      "es de manana", "estamos en la manana", "es de tarde", "estamos en la tarde",
      "ya es de noche", "es de noche", "estamos en la noche", "es de madrugada",
      "what date is today", "what day is it", "what time is it", "tell me the time"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isHomeSummaryQuery(normalized: string): boolean {
    return [
      'como esta la casa',
      'esta todo bien',
      'esta el sistema estable',
      'dame un resumen de la casa',
      'resumen de la casa',
      'estado general de la casa'
    ].some(trigger => normalized.includes(trigger));
  }

  private async handleHomeSummary(language: string, userId: string): Promise<AssistantConversationResponse> {
    const devices = await this.permissionGate.getAuthorizedDevices(userId);
    const active = devices.filter(device => device.lastKnownState?.on === true || device.lastKnownState?.state === 'on').length;
    const unavailable = devices.filter(device => !this.scopeFilter.isDeviceAvailable(device)).length;

    if (language === 'en') {
      return {
        type: 'answer',
        message: devices.length === 0
          ? 'The residence is stable, but no devices are registered yet.'
          : `The residence is stable. ${active} of ${devices.length} devices are active${unavailable > 0 ? `, and ${unavailable} require attention` : ', with none requiring attention'}.`
      };
    }

    return {
      type: 'answer',
      message: devices.length === 0
        ? 'La casa está estable, aunque todavía no hay dispositivos registrados.'
        : `La casa está estable. Hay ${active} de ${devices.length} dispositivos activos${unavailable > 0 ? ` y ${unavailable} requieren atención` : ' y ninguno requiere atención'}.`
    };
  }

  private isAttentionQuery(normalized: string): boolean {
    return [
      'que dispositivos necesitan atencion',
      'cuales dispositivos necesitan atencion',
      'que requiere atencion',
      'que dispositivos no estan disponibles',
      'which devices need attention',
      'which devices are unavailable'
    ].some(trigger => normalized.includes(trigger));
  }

  private async handleAttentionQuery(language: string, userId: string): Promise<AssistantConversationResponse> {
    const unavailable = (await this.permissionGate.getAuthorizedDevices(userId))
      .filter(device => !this.scopeFilter.isDeviceAvailable(device));

    if (unavailable.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? 'No devices require attention right now.'
          : 'No hay dispositivos que requieran atención en este momento.'
      };
    }

    const preview = unavailable.slice(0, 5).map(device => device.name).join(', ');
    const remaining = unavailable.length - 5;
    const suffix = remaining > 0
      ? (language === 'en' ? ', and ' + remaining + ' more.' : ' y ' + remaining + ' más.')
      : '.';

    return {
      type: 'answer',
      message: language === 'en'
        ? unavailable.length + ' devices require attention: ' + preview + suffix
        : unavailable.length + ' dispositivos requieren atención: ' + preview + suffix
    };
  }
  private isRecentActivityQuery(normalized: string): boolean {
    return [
      'que cambio recientemente',
      'cuando se ejecuto por ultima vez',
      'que acciones automaticas se ejecutaron hoy'
    ].some(trigger => normalized.includes(trigger));
  }

  private async handleRecentActivity(language: string): Promise<AssistantConversationResponse> {
    const records = await this.executionRecordRepository.findRecent(5);
    if (records.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? 'There are no recent residential executions to report.'
          : 'No tengo ejecuciones residenciales recientes que reportar.'
      };
    }

    const latest = records[0];
    const description = latest.summary || `${latest.sourceType} ${latest.sourceId}`;
    return {
      type: 'answer',
      message: language === 'en'
        ? `The latest execution was ${description}, with status ${latest.status}.`
        : `La ejecución más reciente fue ${description}, con estado ${latest.status}.`
    };
  }

  private isConversationContextQuery(normalized: string): boolean {
    return [
      'que fue lo ultimo que te pedi',
      'repite tu ultima respuesta',
      'repetir tu ultima respuesta'
    ].some(trigger => normalized.includes(trigger));
  }

  private handleConversationContext(memory: AssistantMemoryState | null, language: string): AssistantConversationResponse {
    if (memory?.originalPrompt) {
      return {
        type: 'answer',
        message: language === 'en'
          ? `Your previous request was: ${memory.originalPrompt}.`
          : `Tu solicitud anterior fue: ${memory.originalPrompt}.`
      };
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? 'I do not have a previous request available in this conversation.'
        : 'No tengo una solicitud anterior disponible en esta conversación.'
    };
  }

  private async handleRoomSelectionForLight(roomId: string, command: DeviceCommandV1, userId: string, language: string, originalPrompt: string, correlationId: string): Promise<AssistantConversationResponse> {
    const room = await this.roomRepository.findRoomById(roomId);
    const roomName = room?.name ?? roomId;

    // 1. Find controllable lights in that room
    const allDevices = await this.permissionGate.getAuthorizedDevices(userId);
    const roomDevices = allDevices.filter(d => d.roomId === roomId);

    const roomLights = roomDevices.filter(d => this.scopeFilter.isLightEntity(d) && this.scopeFilter.isDeviceAvailable(d));

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
      const result = await this.executeAuthorizedCommand(userId, light.id, command, originalPrompt, correlationId);

      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: light.id, name: light.name, type: light.type, roomId: light.roomId }],
        timestamp: new Date().toISOString()
      });

      return {
        type: 'execution',
        message: this.buildCommandSuccessMessage(command, light.name, null, language),
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

    await this.memoryService.saveShortTermMemory(userId, {
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

  private async handleDateTimeQuery(prompt: string, language: string): Promise<AssistantConversationResponse> {
    const timeZone = await this.systemVariableService.getSystemTimezone();
    console.info(`[ASSISTANT_TIME_QUERY] ${JSON.stringify({ timeZone, language })}`);

    const now = new Date();
    const dateStr = now.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone
    });
    const timeStr = now.toLocaleTimeString(language === 'en' ? 'en-US' : 'es-ES', {
      hour: '2-digit', minute: '2-digit', timeZone
    });

    let message = "";
    if (prompt.includes('fecha') || prompt.includes(' dia ') || prompt.startsWith('que dia') || prompt.includes(' day ') || prompt.includes('date')) {
      message = language === 'en' ? `Today is ${dateStr}. Residential schedule remains available.` : `Hoy es ${dateStr}. La agenda residencial queda disponible.`;
    } else if (language === 'es' && (prompt.includes('manana') || prompt.includes('tarde') || prompt.includes('noche') || prompt.includes('madrugada'))) {
      const hourPart = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', hourCycle: 'h23', timeZone })
        .formatToParts(now)
        .find(part => part.type === 'hour')?.value;
      const currentPeriod = getSpanishDayPeriod(Number(hourPart ?? 0));
      const requestedPeriod = prompt.includes('madrugada')
        ? 'madrugada'
        : prompt.includes('manana')
          ? 'mañana'
          : prompt.includes('tarde')
            ? 'tarde'
            : 'noche';
      message = currentPeriod === requestedPeriod
        ? `Sí. Es de ${currentPeriod}. ${formatNaturalSpanishTime(now, timeZone)}.`
        : `No. En este momento es de ${currentPeriod}. ${formatNaturalSpanishTime(now, timeZone)}.`;
    } else {
      message = language === 'en'
        ? `It is ${timeStr}. Home systems remain attentive.`
        : `${formatNaturalSpanishTime(now, timeZone)}. La casa permanece atenta.`;
    }

    return {
      type: 'answer',
      message
    };
  }

  private isGreeting(normalized: string): boolean {
    const greetings = [
      "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
      "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "gracias", "thanks", "thank you"
    ];
    return greetings.some(g => normalized === g || normalized.startsWith(g + " "));
  }

  private isWellnessQuery(normalized: string): boolean {
    const triggers = [
      "como estas", "como stas", "comoe stas", "como te va", "que tal", "q tal", "todo bien", "que tal todo",
      "estas funcionando correctamente", "funcionas correctamente", "estas listo", "estas lista", "estas ahi", "me escuchas",
      "how are you", "how's it going", "hows it going", "are you ok", "how are u"
    ];
    return triggers.some(t => normalized === t || normalized.startsWith(t + " "));
  }

  private isStateQuery(normalized: string): boolean {
    const stateKeywords = [
      'encendido', 'encendidos', 'encendida', 'encendidas',
      'prendido', 'prendidos', 'on', 'active', 'enabled',
      'apagado', 'apagados', 'apagada', 'apagadas',
      'off', 'inactive', 'disabled'
    ];

    const hasState = stateKeywords.some(kw => this.containsWord(normalized, kw));

    const generalTriggers = [
      "que", "hay", "tengo", "luces", "dispositivos", "estado", "cuales", "donde", "quien", "cuanto", "son", "cuarto", "habitacion", "como",
      "esas", "esos", "esa", "eso",
      "what", "whats", "which", "status", "on", "off", "where", "those", "them"
    ];

    const isGeneral = generalTriggers.some(q => this.containsWord(normalized, q));


    const isInventoryCountQuery = this.isInventoryCountQuery(normalized);
    const isRoomStatus = normalized.includes('como esta la ') || normalized.includes('como esta el ');
    const isGeneralState = isGeneral && (
      hasState ||
      isInventoryCountQuery ||
      this.containsWord(normalized, "hay") ||
      this.containsWord(normalized, "estan") ||
      this.containsWord(normalized, "son") ||
      this.containsWord(normalized, "donde") ||
      this.containsWord(normalized, "cuarto") ||
      this.containsWord(normalized, "habitacion") ||
      this.containsWord(normalized, "estado") ||
      this.containsWord(normalized, "status") ||
      this.containsWord(normalized, "esas") ||
      this.containsWord(normalized, "esos") ||
      this.containsWord(normalized, "esa") ||
      this.containsWord(normalized, "eso") ||
      this.containsWord(normalized, "those") ||
      this.containsWord(normalized, "them") ||
      isRoomStatus
    );

    if (!isGeneralState) return false;

    // Safety: if it contains an action verb, it's probably NOT a state query (e.g. "enciende esa")
    const actionVerbs = ['prende', 'apaga', 'enciende', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'turn on', 'turn off', 'open', 'close'];
    const hasAction = actionVerbs.some(v => this.containsWord(normalized, v));

    return !hasAction;
  }


  private isInventoryCountQuery(normalized: string): boolean {
    const inventoryTerms = ['luz', 'luces', 'dispositivo', 'dispositivos', 'light', 'lights', 'device', 'devices'];
    const countTerms = ['cuanto', 'cuantos', 'cuanta', 'cuantas'];

    return inventoryTerms.some((term) => this.containsWord(normalized, term)) && (
      countTerms.some((term) => this.containsWord(normalized, term)) ||
      normalized.includes('how many')
    );
  }
  private async applySafetyGateV2(
    prompt: string,
    userId: string,
    language: 'es' | 'en',
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    const normalized = normalizeAssistantPrompt(prompt);
    const targetPhrase = this.extractTargetPhrase(prompt);

    // A. Unknown Target Blocker
    // If prompt has command verb + device noun + unknown qualifier
    const commandVerbs = ['prende', 'enciende', 'apaga', 'encender', 'apagar', 'activa', 'desactiva', 'abre', 'abrir', 'cierra', 'cerrar', 'turn on', 'turn off', 'open', 'close', 'toggle'];
    const hasVerb = commandVerbs.some(v => normalized.startsWith(v + ' ') || this.containsWord(normalized, v));

    if (this.isManagementIntent(normalized) || this.isDraftCreation(normalized)) return null;

    if (hasVerb && targetPhrase) {
      const isOrdinal = ['primera', 'segunda', 'la primera', 'la segunda', 'first', 'second', 'the first', 'the second'].includes(targetPhrase);
      const isPronoun = ['la', 'lo', 'las', 'los', 'it', 'them', 'esa', 'eso', 'esas', 'esos', 'that', 'those'].includes(targetPhrase) || normalized.endsWith('la') || normalized.endsWith('lo');
      const isMultiCommand = /\s(y|and|then|&)\s/i.test(normalized) || prompt.includes(',') || prompt.includes(';');
      const isBulk = normalized.includes('todo') || normalized.includes('everything');
      const rooms = await this.permissionGate.getAuthorizedRooms(userId);
      const isRoomMentioned = rooms.some(r => normalized.includes(normalizeAssistantPrompt(r.name)));

      if (isOrdinal || isPronoun || isMultiCommand || isBulk || isRoomMentioned) {
        return null; // Let it pass to Follow-up resolver or Interpreter
      }

      const allMatches = await this.findMatchingDevices(prompt, userId);
      if (allMatches.length === 0) {
        // If it's a very vague "luz" or similar, maybe it's not an "unknown target" but a "vague light"
        const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
        if (!isVague) {
          // Attempt Fuzzy Matching before hard blocking
          const allDevices = await this.permissionGate.getAuthorizedDevices(userId);
          const command = (this.inferCommandFromPrompt(normalized) || 'turn_on') as DeviceCommandV1;
          const fuzzyResult = this.findFuzzyCandidateSuggestions(targetPhrase, allDevices, language, command, prompt);

          if (fuzzyResult) {
            if (fuzzyResult.type === 'clarification' && fuzzyResult.clarification) {
              await this.memoryService.saveShortTermMemory(userId, {
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
          return this.withJarvisStyle({
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
    }

    // B. Vague Light Blocker
    const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
    if (hasVerb && isVague && !request.sourceRoomId) {
      const rooms = await this.permissionGate.getAuthorizedRooms(userId);
      const options = rooms.slice(0, 5).map(r => ({
        id: r.id,
        label: r.name,
        kind: 'room' as const
      }));

      const inferredCommand = (this.inferCommandFromPrompt(normalized) || 'turn_on') as DeviceCommandV1;
      await this.memoryService.saveShortTermMemory(userId, {
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
      return this.withJarvisStyle({
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

  private isLikelyHomeControlPrompt(normalized: string): boolean {
    const conversationalPrefixes = [
      'que opinas', 'dime', 'cuentame', 'como funciona', 'explicame', 'hablame', 'sabes algo'
    ];
    if (conversationalPrefixes.some(prefix => normalized.includes(prefix))) {
      return false;
    }

    const triggers = [
      'prende', 'apaga', 'enciende', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'toggle', 'turn on', 'turn off', 'open', 'close',
      'deten', 'detener', 'deja', 'posicion', 'por ciento',
      'encendido', 'apagado', 'prendido', 'on', 'off', 'luz', 'luces', 'light', 'lights', 'cortina', 'cortinas', 'dispositivos', 'estado', 'modo',
      'esa', 'eso', 'esas', 'esos', 'that', 'those', 'them',
      'escena', 'rutina', 'automatizacion', 'scene', 'routine', 'automation',
      'cuando diga', 'llama a', 'when i say',
      'crea', 'haz', 'create', 'make',
      'por qué', 'qué pasó', 'que paso', 'falló', 'fallo', 'revisa', 'why', 'what happened', 'failed', 'check',
      'reintenta', 'prueba otra vez', 'intenta de nuevo', 'retry', 'try again',
      'por que', 'que paso', 'porque fallo', 'por que fallo', 'no prendio', 'no encendio', 'no se prendio', 'no se encendio', 'no apago', 'no se apago', 'reintentar', 'vuelve a intentar'
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isClarificationSelectionReply(normalized: string): boolean {
    // 1. Detect fresh high-level intents
    if (this.aliasManagementService.isAliasCreation(normalized)) return false;
    if (this.isRoomBulkFastPath(normalized)) return false;
    if (this.isBulkFastPath(normalized)) return false;
    if (this.isManagementIntent(normalized)) return false;
    if (this.isLikelyHomeControlPrompt(normalized)) {
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

    if (newIntentKeywords.some(kw => this.containsWord(normalized, kw))) {
      return false;
    }

    if (normalized.includes(' es ')) return false;

    return true;
  }

  /**
   * Builds a Map<roomId, roomName> by querying rooms for each unique homeId
   * found in the provided devices. This avoids the 'system' hardcode bug.
   */
  private async buildRoomNameMap(devices: readonly Device[]): Promise<Map<string, string>> {
    const homeIds = [...new Set(devices.map(d => d.homeId).filter((hid): hid is string => Boolean(hid)))];
    const roomMap = new Map<string, string>();

    for (const homeId of homeIds) {
      const rooms = await this.roomRepository.findRoomsByHomeId(homeId);
      for (const room of rooms) {
        roomMap.set(room.id, room.name);
      }
    }

    return roomMap;
  }

  private isSuggestionAccept(normalized: string): boolean {
    const acceptTriggers = ['si', 'sí', 'si creala', 'sí, créala', 'dale', 'crear', 'hazlo', 'yes', 'create it', 'do it'];
    return acceptTriggers.includes(normalized) || acceptTriggers.some(t => normalized.startsWith(t + ' '));
  }

  private isSuggestionReject(normalized: string): boolean {
    const rejectTriggers = ['no', 'no gracias', 'descartar', 'no thanks', 'dismiss'];
    return rejectTriggers.includes(normalized) || rejectTriggers.some(t => normalized.startsWith(t + ' '));
  }

  private isSuggestionPostpone(normalized: string): boolean {
    const postponeTriggers = ['despues', 'después', 'recuerdamelo despues', 'recuérdamelo después', 'mas tarde', 'más tarde', 'later', 'remind me later'];
    return postponeTriggers.includes(normalized) || postponeTriggers.some(t => normalized.startsWith(t + ' '));
  }

  private isBulkActionAccept(normalized: string): boolean {
    const triggers = ['si', 'sí', 'confirmar', 'dale', 'ok', 'yes', 'confirm', 'proceed'];
    return triggers.includes(normalized);
  }

  private isBulkActionReject(normalized: string): boolean {
    const triggers = ['no', 'cancelar', 'no gracias', 'cancel', 'no thanks'];
    return triggers.includes(normalized);
  }

  private async handleBulkActionAccept(userId: string, language: string, ticket: ConfirmationTicket): Promise<AssistantConversationResponse> {
    const memory = await this.memoryService.getShortTermMemory(userId);
    const allowedCommands = ['turn_on', 'turn_off', 'toggle'];
    if (!allowedCommands.includes(ticket.command)) {
      console.warn(`[ASSISTANT_BULK_EXECUTION_INVALID] {"command":"${ticket.command}"}`);
      return {
        type: 'error',
        message: language === 'en' ? "Invalid command for bulk action." : "Comando inválido para acción en lote."
      };
    }

    // Single-use guarantee: an already-consumed or expired ticket cannot be replayed
    // (e.g. a late "sí", or the same confirmation answered twice in a race).
    const consumed = this.confirmationTicketRepository ? await this.confirmationTicketRepository.consume(ticket.id) : false;
    if (!consumed) {
      console.warn(`[ASSISTANT_BULK_CONFIRMATION_ALREADY_CONSUMED] ${JSON.stringify({ ticketId: ticket.id })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? "That confirmation is no longer available. Please ask again."
          : "Esa confirmación ya no está disponible. Pídemelo de nuevo."
      };
    }

    // Revalidate permissions: the home this ticket was issued for must still be authorized
    // for this user (e.g. access could have been revoked between proposal and confirmation).
    try {
      await this.permissionGate.assertHomeAuthorized(userId, ticket.homeId);
    } catch {
      console.warn(`[ASSISTANT_BULK_CONFIRMATION_HOME_REVOKED] ${JSON.stringify({ userId, homeId: ticket.homeId })}`);
      await this.clearPendingAction(userId);
      return {
        type: 'error',
        message: language === 'en' ? "You're no longer authorized for that action." : "Ya no tienes autorización para esa acción."
      };
    }

    // Revalidate scope: re-check availability/capability/current-state against the CURRENT
    // device state, restricted to the originally proposed device set. A device that changed
    // state, lost its capability, or disappeared in the meantime is dropped rather than
    // blindly re-executed on stale information.
    const command = ticket.command as DeviceCommandV1;
    const currentDevices = await this.permissionGate.getAuthorizedDevices(userId);
    const stillEligible = currentDevices.filter(d => {
      if (!ticket.deviceIds.includes(d.id)) return false;
      if (ticket.command === 'toggle') return this.scopeFilter.isControllableDevice(d, command);
      return this.scopeFilter.isControllableForBulk(d, command, ticket.bulkType || 'all') && this.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (stillEligible.length === 0) {
      await this.clearPendingAction(userId);
      return {
        type: 'answer',
        message: language === 'en'
          ? "Nothing to do — those devices are already in the requested state."
          : "No hay nada que hacer: esos dispositivos ya estaban en el estado solicitado."
      };
    }

    const skippedCount = ticket.deviceIds.length - stillEligible.length;

    console.info(`[ASSISTANT_BULK_EXECUTION_APPROVED] ${JSON.stringify({ count: stillEligible.length, originalCount: ticket.deviceIds.length, command: ticket.command })}`);
    const correlationId = `bulk-${Date.now()}`;
    const results: ExecutedCommandResult[] = [];
    const entities = [];

    for (const device of stillEligible) {
      const result = await this.executeAuthorizedCommand(userId, device.id, command, ticket.originalPrompt, correlationId);
      results.push({ action: { deviceId: device.id, command }, deviceName: device.name, result });
      entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
    }

    await this.clearPendingAction(userId);

    // Save to memory so user can say "apágalas" later
    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'command',
      entities,
      timestamp: new Date().toISOString()
    });

    let summary = this.formatMultiCommandSummary(results, language, ticket.bulkType);
    if (skippedCount > 0) {
      summary += language === 'en'
        ? ` (${skippedCount} device(s) were already in the requested state and were skipped.)`
        : ` (${skippedCount} dispositivo(s) ya estaban en el estado solicitado y se omitieron.)`;
    }

    return await this.attachSuggestionIfNeeded({
      type: 'execution',
      message: summary,
      execution: {
        sceneId: 'bulk_action',
        status: (() => {
          const successCount = results.filter(r => r.result.status === 'success').length;
          if (successCount === results.length) return 'success';
          return successCount === 0 ? 'failed' : 'partial';
        })(),
        actions: results.flatMap(r => r.result.actions)
      }
    }, userId, language, memory, 'multi_command');
  }

  private async handleBulkActionReject(userId: string, language: 'es' | 'en', ticket: ConfirmationTicket): Promise<AssistantConversationResponse> {
    console.info(`[ASSISTANT_BULK_EXECUTION_CANCELLED] ${JSON.stringify({ count: ticket.deviceIds.length, command: ticket.command })}`);
    if (this.confirmationTicketRepository) await this.confirmationTicketRepository.consume(ticket.id);
    await this.clearPendingAction(userId);
    return {
      type: 'answer',
      message: getAssistantResponseText('action.cancelled', language, {})
    };
  }

  private async handleSuggestionAccept(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';

    await this.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'accepted');

    let message = isEn ? "Done! I've created a draft for you." : "¡Listo! He creado un borrador para ti.";

    if (suggestion.type === 'alias_suggestion') {
      const metadata = suggestion.metadata;
      const alias = typeof metadata['alias'] === 'string' ? metadata['alias'] : undefined;
      const target = typeof metadata['target'] === 'string' ? metadata['target'] : undefined;
      const confidence = typeof metadata['confidence'] === 'string' ? metadata['confidence'] : undefined;

      if (confidence === 'high' && alias && target) {
        const devices = await this.permissionGate.getAuthorizedDevices(userId);
        const rooms = await this.permissionGate.getAuthorizedRooms(userId);

        const matchingDevices = devices.filter(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(target));
        const matchingRooms = rooms.filter(r => normalizeAssistantPrompt(r.name) === normalizeAssistantPrompt(target));

        const totalMatches = matchingDevices.length + matchingRooms.length;

        // Safety: check alias does not match existing device name
        const nameCollision = devices.some(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(alias));
        // Safety: check alias does not already exist
        const existingAlias = await this.memoryService.getAlias(userId, alias);

        if (totalMatches === 1 && !nameCollision && !existingAlias) {
          const targetEntity = matchingDevices.length > 0 ? matchingDevices[0] : matchingRooms[0];
          const type = matchingDevices.length > 0 ? 'device' : 'room';

          await this.memoryService.setAlias(userId, alias, targetEntity.id);

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
          await this.draftService.createDraft(userId, 'scene', {
            roomId, deviceIds, homeId
          });
          message = isEn
            ? "I've created a scene draft with those devices. You can find it in your drafts."
            : "He creado un borrador de escena con esos dispositivos. Puedes encontrarlo en tus borradores.";
        } else if (suggestion.type === 'automation_suggestion' && deviceId) {
          await this.draftService.createDraft(userId, 'automation', {
            deviceId, hour, homeId, trigger: { type: 'time', hour: Number(hour) }
          });
          message = isEn
            ? "I've created an automation draft for you. You can review it in your drafts."
            : "He creado un borrador de automatización para ti. Puedes revisarlo en tus borradores.";
        }
      }
    }

    await this.clearPendingAction(userId);
    return { type: 'answer', message };
  }

  private async handleSuggestionReject(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    await this.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'rejected');
    await this.clearPendingAction(userId);
    return {
      type: 'answer',
      message: language === 'en' ? "Understood, I won't suggest this again for now." : "Entendido, no volveré a sugerirte esto por ahora."
    };
  }

  private async handleSuggestionPostpone(userId: string, language: string, suggestion: PendingSuggestion): Promise<AssistantConversationResponse> {
    await this.learningService.recordSuggestionResponse(userId, suggestion.id, suggestion.type, 'postponed');
    await this.clearPendingAction(userId);
    return {
      type: 'answer',
      message: language === 'en' ? "Okay, I'll remind you later." : "Está bien, te lo recordaré más tarde."
    };
  }

  private async attachSuggestionIfNeeded(response: AssistantConversationResponse, userId: string, language: string, memory: AssistantMemoryState | null, context?: SuggestionContext): Promise<AssistantConversationResponse> {
    if (response.type !== 'answer' && response.type !== 'execution') return response;

    // Safety guards
    if (memory?.pendingSuggestion) return response; // No stacking
    if (memory?.pendingIntent || memory?.clarificationOptions || memory?.pendingDraft || memory?.pendingManagementAction) return response;

    const allowedContexts: SuggestionContext[] = ['command', 'multi_command', 'scene', 'state_query', 'room_query', 'list_query'];
    if (!context || !allowedContexts.includes(context)) return response;

    const suggestion = await this.suggestionService.getSuggestion(userId, language);
    if (suggestion) {
      const memoryUpdate: AssistantMemoryState = {
        ...(memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }),
        pendingSuggestion: {
          ...suggestion,
          createdAt: new Date().toISOString()
        }
      };
      await this.memoryService.saveShortTermMemory(userId, memoryUpdate);

      const hint = language === 'en'
        ? '\nYou can reply: "yes, create it", "no thanks", or "later".'
        : '\nPuedes responder: "sí, créala", "no, gracias" o "después".';

      response.message += `\n\n💡 ${suggestion.message}${hint}`;
    }

    return response;
  }

  /** Returns the display name for a roomId using the provided map. */
  private resolveRoomName(roomId: string | null, roomMap: Map<string, string>, language: string): string | null {
    if (roomId === null) return language === 'en' ? 'No room' : 'Sin estancia';
    const name = roomMap.get(roomId);
    if (!name) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] roomId "${roomId}" not found in room map`);
      }
      return language === 'en' ? 'Room not found' : 'Estancia no encontrada';
    }
    return name;
  }

  private async handleStateQuery(
    normalized: string,
    language: string,
    userName: string | null,
    userId: string,
    entitiesFromMemory?: AssistantMemoryEntity[],
    sourceRoomId?: string | null
  ): Promise<AssistantConversationResponse> {
    let allDevices: readonly Device[];

    if (entitiesFromMemory && entitiesFromMemory.length > 0) {
      const ids = entitiesFromMemory.map(e => e.id);
      const devices = await this.permissionGate.getAuthorizedDevices(userId);
      allDevices = devices.filter(d => ids.includes(d.id));
    } else {
      allDevices = await this.permissionGate.getAuthorizedDevices(userId);
    }

    if (!allDevices) {
      return {
        type: 'answer',
        message: getAssistantResponseText('state.detail_no_devices', language, {})
      };
    }

    // Resolve room map from repository
    // Priority: Rooms belonging to the homes of the devices being queried
    const roomMap = await this.buildRoomNameMap(allDevices);

    // Fallback: If no rooms found via device homes, try global room list
    if (roomMap.size === 0) {
      const allRooms = await this.permissionGate.getAuthorizedRooms(userId);
      for (const r of allRooms) roomMap.set(r.id, r.name);
    }

    const isLightsOnly = normalized.includes('luz') || normalized.includes('luces') || normalized.includes('light');

    // Detect keywords
    const onKeywords = ['encendido', 'encendidos', 'encendida', 'encendidas', 'prendido', 'prendidos', 'on', 'active', 'enabled'];
    const offKeywords = ['apagado', 'apagados', 'apagada', 'apagadas', 'off', 'inactive', 'disabled'];

    const isOnQuery = onKeywords.some(kw => normalized.includes(kw));
    const isOffQuery = offKeywords.some(kw => normalized.includes(kw));
    const isCompound = isOnQuery && isOffQuery;
    const hasNoExplicitState = !isOnQuery && !isOffQuery;

    // Detect target room from the resolved map + user aliases
    let targetRoomId: string | null = null;
    let targetRoomName: string | null = null;

    // We use the same resolution logic as in singular light path for consistency
    const userAliases = await this.memoryService.getAliases(userId);
    const rooms = await this.permissionGate.getAuthorizedRooms(userId);

    // We need to identify if there's a potential room mention in the prompt.
    // Since we don't have a static list, we'll look for room names or aliases in the prompt.
    const resolution = this.resolveRoomReference(normalized, rooms, allDevices, userId, userAliases);

    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      targetRoomId = resolution.rooms[0].id;
      targetRoomName = resolution.rooms[0].name;
    } else if (resolution.status === 'ambiguous') {
      // For state queries, if ambiguous, we can either return an answer or just treat as global.
      // But the requirement says: "If a phrase looks like it references a room but no room resolves, return: No encontré esa estancia."
      // Ambiguous is a form of "not resolved yet".
      return {
        type: 'answer',
        message: getAssistantResponseText('state.room_ambiguous', language, {})
      };
    }

    // Detect if the prompt seems to mention a room but it wasn't resolved.
    // This is tricky without a static list. A common pattern is "en [lugar]".
    // If we didn't resolve a room but the prompt has "en " followed by words...
    if (!targetRoomId && (normalized.includes(' en ') || normalized.includes(' de la ') || normalized.includes(' del '))) {
       // Heuristic: if we see a preposition but no room matched, it's likely an unknown room.
       // We exclude global terms like "casa", "hogar", "home".
       const isGlobal = normalized.includes('casa') || normalized.includes('hogar') || normalized.includes('home');
       if (!isGlobal) {
         return {
           type: 'answer',
           message: getAssistantResponseText('state.room_not_found', language, {})
         };
       }
    }

    // Filtering
    let filteredDevices = allDevices;
    if (!entitiesFromMemory || entitiesFromMemory.length === 0) {
      if (targetRoomId) {
        filteredDevices = allDevices.filter(d => d.roomId === targetRoomId);
      } else {
        if (sourceRoomId) {
          filteredDevices = allDevices.filter(d => d.roomId === sourceRoomId);
          targetRoomId = sourceRoomId;
          targetRoomName = roomMap.get(sourceRoomId) || null;
        } else if (
          !normalized.includes('estado') &&
          !normalized.includes('que') &&
          !normalized.includes('qué') &&
          !normalized.includes('todas') &&
          (normalized.includes(' la luz') || normalized.includes(' las luces')) &&
          !normalized.includes(' de ') &&
          !normalized.includes(' en ')
        ) {
          const rooms = await this.permissionGate.getAuthorizedRooms(userId);
          const options = rooms.map(r => ({ id: r.id, label: r.name, kind: 'room' as const }));

          await this.memoryService.saveShortTermMemory(userId, {
            lastQueryType: 'clarification',
            entities: [],
            timestamp: new Date().toISOString(),
            clarificationOptions: options,
            originalPrompt: normalized
          });

          return {
            type: 'clarification',
            message: getAssistantResponseText('state.room_selection_required', language, {}),
            clarification: {
              question: getAssistantResponseText('state.room_selection_question', language, {}),
              options,
              pendingAction: { originalPrompt: normalized }
            }
          };
        }
      }

      if (isLightsOnly) {
        filteredDevices = filteredDevices.filter(d => this.scopeFilter.isLightEntity(d));
      }
    }

    const targetEntityLabel = language === 'en'
      ? (isLightsOnly ? 'lights' : 'devices')
      : (isLightsOnly ? 'luces' : 'dispositivos');

    // If no devices match the query at all
    if (filteredDevices.length === 0) {
      if (targetRoomName) {
        return {
          type: 'answer',
          message: getAssistantResponseText('state.no_targets_in_room', language, { entityLabel: targetEntityLabel, roomName: targetRoomName })
        };
      }
      return {
        type: 'answer',
        message: getAssistantResponseText('state.no_matching_targets', language, {})
      };
    }

    // Split into explicit On/Off
    if (this.isInventoryCountQuery(normalized)) {
      const itemLabel = language === 'en'
        ? (isLightsOnly ? (filteredDevices.length === 1 ? 'light' : 'lights') : (filteredDevices.length === 1 ? 'device' : 'devices'))
        : (isLightsOnly ? (filteredDevices.length === 1 ? 'luz' : 'luces') : (filteredDevices.length === 1 ? 'dispositivo' : 'dispositivos'));
      const roomSuffix = targetRoomName
        ? (language === 'en' ? ` in ${targetRoomName}` : ` en ${targetRoomName}`)
        : '';

      return {
        type: 'answer',
        message: getAssistantResponseText('state.inventory_count', language, { count: filteredDevices.length, itemLabel, roomSuffix })
      };
    }

    const onDevices = filteredDevices.filter(d => d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on'));
    const offDevices = filteredDevices.filter(d => d.lastKnownState && (d.lastKnownState.on === false || d.lastKnownState.state === 'off'));

    const isBroadQuery = (norm: string): boolean => {
      const broadTriggers = [
        'estado de la casa',
        'estado',
        'qué hay encendido y apagado',
        'que hay encendido y apagado',
        'home status',
        'house status',
        'status'
      ];
      // Check for exact matches to avoid catching "estado de la luz cocina"
      return broadTriggers.some(t => norm === t);
    };

    if (isBroadQuery(normalized) && !entitiesFromMemory) {
      const activeRooms = [...new Set(onDevices.map(d => this.resolveRoomName(d.roomId, roomMap, language)).filter(Boolean))];
      const namePrefix = userName ? `${userName}, ` : '';
      let broadMsg = "";

      if (language === 'es') {
        broadMsg = `${namePrefix}Estado de la casa:\n`;
        broadMsg += `• Encendidas: ${onDevices.length} luces/dispositivos\n`;
        broadMsg += `• Apagadas: ${offDevices.length} luces/dispositivos\n`;
        if (activeRooms.length > 0) {
          broadMsg += `• Estancias con actividad: ${activeRooms.join(', ')}\n`;
        }
        broadMsg += `\nPuedes pedir: "dame detalle" para ver la lista completa.`;
      } else {
        broadMsg = `${namePrefix}Home status:\n`;
        broadMsg += `• On: ${onDevices.length} lights/devices\n`;
        broadMsg += `• Off: ${offDevices.length} lights/devices\n`;
        if (activeRooms.length > 0) {
          broadMsg += `• Active rooms: ${activeRooms.join(', ')}\n`;
        }
        broadMsg += `\nYou can say: "show detail" to see the full list.`;
      }

      // Still save memory for "dame detalle" follow-up
      this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'state_devices',
        entities: filteredDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          roomId: d.roomId,
          roomName: this.resolveRoomName(d.roomId, roomMap, language) ?? undefined
        })),
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return {
        type: 'answer',
        message: broadMsg
      };
    }

    let message = "";
    const namePrefix = userName ? `${userName}, ` : '';

    const areaPrefix = targetRoomName
      ? `${namePrefix}${targetRoomName}\n\n`
      : (language === 'en' ? `${namePrefix}home status:\n\n` : `${namePrefix}estado de la casa:\n\n`);

    message = areaPrefix;

    if (isCompound || hasNoExplicitState) {
      // If devices exist but we have NO known states for any of them, fallback gracefully
      if (onDevices.length === 0 && offDevices.length === 0) {
        return {
          type: 'answer',
          message: getAssistantResponseText('state.no_matching_targets', language, {})
        };
      }

      message = areaPrefix;

      // On section
      message += targetRoomName
        ? (language === 'en' ? `On · ${onDevices.length}\n` : `Encendidas · ${onDevices.length}\n`)
        : (language === 'en' ? "On:\n" : "Encendidas:\n");
      if (onDevices.length > 0) {
        for (const d of onDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${targetRoomName ? '' : rName ? ` (${rName})` : ''}\n`;
        }
      } else {
        message += language === 'en' ? "• None" : "• Ninguna";
      }

      message += "\n";

      // Off section
      message += targetRoomName
        ? (language === 'en' ? `Off · ${offDevices.length}\n` : `Apagadas · ${offDevices.length}\n`)
        : (language === 'en' ? "Off:\n" : "Apagadas:\n");
      if (offDevices.length > 0) {
        for (const d of offDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${targetRoomName ? '' : rName ? ` (${rName})` : ''}\n`;
        }
      } else {
        message += language === 'en' ? "• None" : "• Ninguna";
      }
    } else if (isOnQuery) {
      if (onDevices.length === 0) {
        message = language === 'en'
          ? `No ${isLightsOnly ? 'lights' : 'devices'} are currently on${targetRoomName ? ' in ' + targetRoomName : ''}.`
          : `No hay ${isLightsOnly ? 'luces' : 'dispositivos'} encendidas${targetRoomName ? ' en ' + targetRoomName : ''} en este momento.`;
      } else {
        message = language === 'en'
          ? `${namePrefix}you have ${onDevices.length} ${isLightsOnly ? 'lights' : 'devices'} on${targetRoomName ? ' in ' + targetRoomName : ''}:\n`
          : `${namePrefix}tienes ${onDevices.length} ${isLightsOnly ? 'luces' : 'dispositivos'} encendidas${targetRoomName ? ' en ' + targetRoomName : ''}:\n`;
        message = message.charAt(0).toUpperCase() + message.slice(1);
        for (const d of onDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
        }
      }
    } else {
      // Off query
      if (offDevices.length === 0) {
        message = language === 'en'
          ? `No ${isLightsOnly ? 'lights' : 'devices'} are currently off${targetRoomName ? ' in ' + targetRoomName : ''}.`
          : `No hay ${isLightsOnly ? 'luces' : 'dispositivos'} apagadas${targetRoomName ? ' en ' + targetRoomName : ''} en este momento.`;
      } else {
        message = language === 'en'
          ? `${namePrefix}you have ${offDevices.length} ${isLightsOnly ? 'lights' : 'devices'} off${targetRoomName ? ' in ' + targetRoomName : ''}:\n`
          : `${namePrefix}tienes ${offDevices.length} ${isLightsOnly ? 'luces' : 'dispositivos'} apagadas${targetRoomName ? ' en ' + targetRoomName : ''}:\n`;
        message = message.charAt(0).toUpperCase() + message.slice(1);
        for (const d of offDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
        }
      }
    }

    // V2: Save state result to memory with roomName cached — avoids re-fetching on follow-ups
    if (filteredDevices && filteredDevices.length > 0) {
      this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'state_devices',
        entities: filteredDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          roomId: d.roomId,
          roomName: this.resolveRoomName(d.roomId, roomMap, language) ?? undefined
        })),
        timestamp: new Date().toISOString()
      }).catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[AssistantConversation] saveShortTermMemory (state) failed:', err instanceof Error ? err.message : String(err));
        }
      });
    }

    // V2: Room resolution — use cached roomName from memory or roomMap
    const isRoomQuery = normalized.includes('donde') || normalized.includes('dónde') || normalized.includes('where');
    if (isRoomQuery && entitiesFromMemory && entitiesFromMemory.length > 0) {
      let roomMessage = '';
      for (const d of filteredDevices) {
        // Prefer cached roomName from memory entity, fall back to map lookup
        const memEntity = entitiesFromMemory.find(e => e.id === d.id);
        const rName = memEntity?.roomName ?? this.resolveRoomName(d.roomId, roomMap, language);
        roomMessage += `${d.name} (${rName ?? (language === 'en' ? 'No room' : 'Sin estancia')})\n`;
      }
      return { type: 'answer', message: roomMessage.trim() };
    }

    return {
      type: 'answer',
      message: message.trim()
    };
  }

  private isDetailFollowUp(normalized: string): boolean {
    const detailTriggers = [
      "dame detalle", "detalle", "ver detalle", "lista completa", "muestrame todo", "muéstrametodo",
      "show detail", "full list", "details", "more detail"
    ];
    return detailTriggers.includes(normalized);
  }

  private async handleDetailFollowUp(memory: AssistantMemoryState, language: string, userId: string): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const rememberedIds = (memory.entities || []).map(e => e.id);
    const devices = await this.permissionGate.getAuthorizedDevices(userId);
    const filtered = devices.filter(d => rememberedIds.includes(d.id));

    if (filtered.length === 0) {
      return {
        type: 'answer',
        message: isEn ? "I don't have the details for that anymore." : "Ya no tengo los detalles de esa consulta."
      };
    }

    const onDevices = filtered.filter(d => d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on'));
    const offDevices = filtered.filter(d => d.lastKnownState && (d.lastKnownState.on === false || d.lastKnownState.state === 'off'));

    const roomMap = await this.buildRoomNameMap(filtered);

    let message = isEn ? "House detail:\n" : "Detalle de la casa:\n";

    if (onDevices.length > 0) {
      message += isEn ? "\nOn:\n" : "\nEncendidas:\n";
      for (const d of onDevices) {
        const rName = this.resolveRoomName(d.roomId, roomMap, language);
        message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
      }
    }

    if (offDevices.length > 0) {
      message += isEn ? "\nOff:\n" : "\nApagadas:\n";
      for (const d of offDevices) {
        const rName = this.resolveRoomName(d.roomId, roomMap, language);
        message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
      }
    }

    return {
      type: 'answer',
      message: message.trim()
    };
  }

  private findFuzzyCandidateSuggestions(targetPhrase: string, devices: readonly Device[], language: string, command: DeviceCommandV1, originalPrompt: string): AssistantConversationResponse | null {
    if (!targetPhrase || targetPhrase.trim().length < 3) return null;

    const targetNorm = sharedNormalizeText(targetPhrase);

    let bestMatch: Device | null = null;
    let bestScore = 0; // 0 to 1, where 1 is exact match

    for (const d of devices) {
      if (!this.scopeFilter.isDeviceAvailable(d)) continue;
      // Note: we don't strictly filter by supportsCommand here because maybe they asked "prende la tv" but it's a sensor?
      // Actually we should only suggest controllable devices if it's a command.
      if (!this.scopeFilter.isControllableDevice(d, command)) continue;

      const nameNorm = sharedNormalizeText(d.name);

      // Calculate similarity
      const distance = levenshteinDistance(targetNorm, nameNorm);
      const maxLength = Math.max(targetNorm.length, nameNorm.length);
      const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = d;
      }
    }

    // High confidence threshold (e.g. "lux sal" vs "luz sala") -> usually > 0.7 similarity
    if (bestMatch && bestScore >= 0.7) {
      return {
        type: 'clarification',
        message: getAssistantResponseText('fuzzy.suggestion', language, { targetPhrase, deviceName: bestMatch.name }),
        clarification: {
          question: getAssistantResponseText('fuzzy.question', language, { deviceName: bestMatch.name }),
          options: [{ id: bestMatch.id, label: bestMatch.name, kind: 'device' }],
          pendingAction: {
            command,
            originalPrompt
          }
        }
      };
    }

    // Low confidence or no match
    return {
      type: 'answer',
      message: getAssistantResponseText('fuzzy.not_found', language, { targetPhrase })
    };
  }

  private async findMatchingDevices(prompt: string, userId: string = 'system'): Promise<Device[]> {
    const normalized = normalizeAssistantPrompt(prompt);
    let devices = await this.permissionGate.getAuthorizedDevices(userId);

    // Filter out non-controllable/deprecated devices
    devices = devices.filter(d => this.scopeFilter.isDeviceAvailable(d));

    // 1. Check for Exact Match first (highest priority)
    const exactMatch = devices.find(d => normalizeAssistantPrompt(d.name) === normalized);
    if (exactMatch) return [exactMatch];

    // 2. Phrase Matching (Requirement: normalized prompt contains device name)
    // "prende luz escritorio" -> matchea "luz escritorio" pero no "luz cocina"
    const phraseMatches = devices.filter(d => {
      const deviceName = normalizeAssistantPrompt(d.name);
      return normalized.includes(deviceName);
    });

    // Si hay un único match por frase contenida, lo devolvemos directamente (Requirement A)
    if (phraseMatches.length === 1) {
      return [phraseMatches[0]];
    }

    if (phraseMatches.length > 1) {
      // Si hay varios, ordenamos por nombre más largo (más específico) y luego por uso (Requirement B)
      const mostUsed = await this.learningService.getMostUsedDevices(userId);
      const usageMap = new Map(mostUsed.map(u => [u.entityId, u.count]));

      phraseMatches.sort((a, b) => {
        if (b.name.length !== a.name.length) return b.name.length - a.name.length;
        const usageA = usageMap.get(a.id) || 0;
        const usageB = usageMap.get(b.id) || 0;
        return usageB - usageA;
      });

      return phraseMatches.slice(0, 3);
    }

    // 3. Fallback: Token-based matching (Requirement C: "Solo si no hay phraseMatches usar token/fuzzy ranking")
    // "prende luz" -> no matchea ninguna frase completa, buscamos tokens
    const scored = devices.map(d => {
      const name = normalizeAssistantPrompt(d.name);
      const tokens = name.split(' ');
      let score = 0;

      const targetTokens = normalized.split(' ').filter(t => t.length > 2 && !['prende', 'enciende', 'apaga', 'turn', 'on', 'off', 'las', 'los', 'del', 'the'].includes(t));

      let matchCount = 0;
      for (const token of tokens) {
        if (targetTokens.some(tt => tt.includes(token) || token.includes(tt))) {
          matchCount++;
        }
      }

      let targetMatchCount = 0;
      for (const tt of targetTokens) {
        if (tokens.some(token => token.includes(tt) || tt.includes(token))) {
          targetMatchCount++;
        }
      }

      const overlap = tokens.length > 0 ? (matchCount / tokens.length) : 0;
      const targetOverlap = targetTokens.length > 0 ? (targetMatchCount / targetTokens.length) : 0;

      if (overlap >= 0.5 && targetOverlap >= 0.6) {
        score = 10;
      } else if (overlap === 1.0) {
        score = 10;
      }

      return { device: d, score };
    }).filter(item => item.score > 0);

    if (scored.length === 0) return [];

    const mostUsedFallback = await this.learningService.getMostUsedDevices(userId);
    const usageMapFallback = new Map(mostUsedFallback.map(u => [u.entityId, u.count]));

    scored.sort((a, b) => {
      const usageA = usageMapFallback.get(a.device.id) || 0;
      const usageB = usageMapFallback.get(b.device.id) || 0;
      return usageB - usageA;
    });

    return scored.slice(0, 3).map(item => item.device);
  }

  // --- SENSOR READING QUERIES ---

  private isSensorReadingQuery(normalized: string): boolean {
    const metricTerms = ['temperatura', 'temperature', 'humedad', 'humidity'];
    if (metricTerms.some((term) => normalized.includes(term))) return true;

    const sensorTerms = ['sensor', 'lectura', 'reading'];
    const questionTerms = ['cual', 'cuál', 'cuanto', 'cuánto', 'valor', 'value', 'dime', 'tell me', 'what is', 'how much'];
    return sensorTerms.some((term) => normalized.includes(term))
      && questionTerms.some((term) => normalized.includes(term));
  }

  private async handleSensorReadingQuery(normalized: string, language: string, userId: string): Promise<AssistantConversationResponse> {
    const sensors = (await this.permissionGate.getAuthorizedDevices(userId))
      .filter((device) => device.type === 'sensor' || device.type === 'binary_sensor');
    const metricTerms = ['temperatura', 'temperature', 'humedad', 'humidity'].filter((term) => normalized.includes(term));
    const matches = sensors.filter((device) => {
      const normalizedName = normalizeAssistantPrompt(device.name);
      const normalizedExternalId = normalizeAssistantPrompt(device.externalId);
      const explicitlyNamed = normalized.includes(normalizedName);
      const metricMatch = metricTerms.some((term) => normalizedName.includes(term) || normalizedExternalId.includes(term));
      return explicitlyNamed || metricMatch;
    });

    if (matches.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('sensor.not_found', language, {}) };
    }

    if (matches.length > 1) {
      const options = matches.map((device) => ({ id: device.id, label: device.name, kind: 'device' as const }));
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'sensor_reading',
        source: 'sensor_reading',
        entities: matches.map((device) => ({ id: device.id, name: device.name, type: device.type, roomId: device.roomId })),
        clarificationOptions: options,
        originalPrompt: normalized,
        timestamp: new Date().toISOString(),
      });
      return {
        type: 'clarification',
        message: getAssistantResponseText('sensor.clarification', language, {}),
        clarification: {
          question: getAssistantResponseText('sensor.clarification_question', language, {}),
          options,
          pendingAction: { originalPrompt: normalized },
        },
      };
    }

    return this.buildSensorReadingResponse(matches[0], language);
  }

  private async handleSensorReadingSelection(userId: string, sensorId: string, language: string): Promise<AssistantConversationResponse> {
    const sensor = (await this.permissionGate.getAuthorizedDevices(userId))
      .find((device) => device.id === sensorId && (device.type === 'sensor' || device.type === 'binary_sensor'));
    if (!sensor) {
      return { type: 'answer', message: getAssistantResponseText('sensor.selection_unavailable', language, {}) };
    }

    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'sensor_reading',
      source: 'sensor_reading',
      entities: [{ id: sensor.id, name: sensor.name, type: sensor.type, roomId: sensor.roomId }],
      timestamp: new Date().toISOString(),
    });
    return this.buildSensorReadingResponse(sensor, language);
  }

  private buildSensorReadingResponse(sensor: Device, language: string): AssistantConversationResponse {
    const state = sensor.lastKnownState?.state;
    const normalizedState = typeof state === 'string' ? state.trim().toLowerCase() : '';
    if (state === undefined || state === null || state === '' || normalizedState === 'unknown' || normalizedState === 'unavailable') {
      return { type: 'answer', message: getAssistantResponseText('sensor.unavailable', language, { name: sensor.name }) };
    }

    const rawAttributes = sensor.lastKnownState?.attributes;
    const attributes = rawAttributes && typeof rawAttributes === 'object'
      ? rawAttributes as Record<string, unknown>
      : {};
    const unit = typeof attributes.unit_of_measurement === 'string' && attributes.unit_of_measurement.trim()
      ? ' ' + attributes.unit_of_measurement.trim()
      : '';
    return {
      type: 'answer',
      message: getAssistantResponseText('sensor.reading', language, { name: sensor.name, value: String(state), unit }),
    };
  }

  // --- POINT STATE QUERIES ---

  private isPointStateQuery(normalized: string): boolean {
    // Si empieza por palabras interrogativas generales, delegar a State Query
    if (normalized.startsWith('que ') || normalized.startsWith('quien ') || normalized.startsWith('cuales ') || normalized.startsWith('cuáles ') || normalized.startsWith('what ') || normalized.startsWith('which ')) {
      return false;
    }

    const triggers = [
      'esta encendida', 'esta encendido', 'esta prendida', 'esta prendido', 'is on',
      'esta apagada', 'esta apagado', 'is off'
    ];
    return triggers.some(t => normalized.includes(t)) ||
           (normalized.startsWith('esta ') && (normalized.includes('prendid') || normalized.includes('encendid') || normalized.includes('apagad')));
  }

  private async handlePointStateQuery(normalized: string, language: string, userId: string): Promise<AssistantConversationResponse> {
    const devices = await this.permissionGate.getAuthorizedDevices(userId);

    // Buscar dispositivo en el prompt
    const matches = devices.filter(d => normalized.includes(normalizeAssistantPrompt(d.name)));

    if (matches.length === 0) {
      // Intentar buscar habitación
      const rooms = (await this.permissionGate.getAuthorizedRooms(userId)) || [];
      const roomMatch = rooms.find(r => normalized.includes(normalizeAssistantPrompt(r.name)));

      if (roomMatch) {
        const roomDevices = devices.filter(d => d.roomId === roomMatch.id && this.scopeFilter.isControllableDevice(d, 'turn_on'));
        if (roomDevices.length === 0) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_no_controllable', language, { roomName: roomMatch.name })
          };
        }

        const onDevices = roomDevices.filter(d => d.lastKnownState?.state === 'on');
        const total = roomDevices.length;

        if (onDevices.length === 0) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_all_off', language, { roomName: roomMatch.name })
          };
        } else if (onDevices.length === total) {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_all_on', language, { roomName: roomMatch.name })
          };
        } else {
          return {
            type: 'answer',
            message: getAssistantResponseText('state.room_summary', language, { onCount: onDevices.length, total, roomName: roomMatch.name })
          };
        }
      }

      return {
        type: 'answer',
        message: getAssistantResponseText('state.device_not_found', language, {})
      };
    }

    if (matches.length > 1) {
      const options = matches.map(d => ({ id: d.id, label: d.name, kind: 'device' as const }));
      return {
        type: 'clarification',
        message: getAssistantResponseText('state.device_multiple_matches', language, {}),
        clarification: { question: getAssistantResponseText('clarification.which_one', language, {}), options, pendingAction: { originalPrompt: normalized } }
      };
    }

    const device = matches[0];
    const state = device.lastKnownState?.state;
    const isAskingOn = normalized.includes('encendid') || normalized.includes('prendid') || normalized.includes('on');
    const isAskingOff = normalized.includes('apagad') || normalized.includes('off');

    const isOn = state === 'on' || (typeof state === 'number' && state > 0);

    let answer = '';
    if (isAskingOn) {
      answer = getAssistantResponseText('state.device_query_on', language, { deviceName: device.name, isOn });
    } else if (isAskingOff) {
      answer = getAssistantResponseText('state.device_query_off', language, { deviceName: device.name, isOff: !isOn });
    } else {
      answer = getAssistantResponseText('state.device_status', language, { deviceName: device.name, isOn });
    }

    return { type: 'answer', message: answer };
  }

  // --- LISTING ---

  private isListScenesIntent(normalized: string): boolean {
    return normalized.includes('escenas') && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list') || normalized.includes('show'));
  }

  private async handleListScenes(language: string, userId: string): Promise<AssistantConversationResponse> {
    const scenes = await this.permissionGate.getAuthorizedScenes(userId);
    if (scenes.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('listing.scenes_empty', language, {}) };
    }
    const list = scenes.map(s => `• ${s.name}`).join('\n');
    return {
      type: 'answer',
      message: getAssistantResponseText('listing.scenes', language, { list })
    };
  }

  private isListAutomationsIntent(normalized: string): boolean {
    return (normalized.includes('automatizaciones') || normalized.includes('rutinas') || normalized.includes('automations')) && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list'));
  }

  private async handleListAutomations(language: string, userId: string): Promise<AssistantConversationResponse> {
    const automations = await this.permissionGate.getAuthorizedAutomations(userId);
    if (automations.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('listing.automations_empty', language, {}) };
    }
    const list = automations.map((automation) => getAssistantResponseText('listing.automation_status', language, { name: automation.name, enabled: automation.enabled })).join('\n');
    return {
      type: 'answer',
      message: getAssistantResponseText('listing.automations', language, { list })
    };
  }

  // --- MANAGEMENT ---

  private isManagementIntent(normalized: string): boolean {
    const managementKeywords = ['renombra', 'cambia el nombre', 'rename', 'change name', 'activa', 'desactiva', 'pausa', 'resume', 'enable', 'disable', 'agrega', 'add', 'quita', 'remove'];
    return managementKeywords.some(kw => normalized.includes(kw)) &&
           (normalized.includes('escena') || normalized.includes('automatizacion') || normalized.includes('rutina') || normalized.includes('scene') || normalized.includes('automation') || normalized.includes('routine'));
  }

  private async handleManagementIntent(normalized: string, userId: string, language: string): Promise<AssistantConversationResponse> {
    // 1. Rename Scene
    const renameSceneMatch = normalized.match(/(?:renombra|rename|cambia el nombre de|change name of) (?:la escena|the scene)? (.+) (?:a|to) (.+)/i);
    if (renameSceneMatch) {
      const oldName = renameSceneMatch[1].trim();
      const newName = renameSceneMatch[2].trim();
      const scenes = await this.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(oldName));

      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: oldName }) };

      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'rename_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { newName },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.rename_scene_confirmation', language, { sceneName: scene.name, newName }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // 2. Toggle Automation
    const toggleAutoMatch = normalized.match(/(activa|desactiva|enable|disable|activate|deactivate|pausa|resume) (?:la automatizacion|the automation|la rutina|the routine)? (.+)/i);
    if (toggleAutoMatch) {
      const actionStr = toggleAutoMatch[1].trim();
      const autoName = toggleAutoMatch[2].trim();
      const enabled = ['activa', 'enable', 'activate', 'resume'].includes(actionStr);

      const automations = await this.permissionGate.getAuthorizedAutomations(userId);
      const auto = automations.find(a => normalizeAssistantPrompt(a.name) === normalizeAssistantPrompt(autoName));

      if (!auto) return { type: 'answer', message: getAssistantResponseText('management.automation_not_found', language, { name: autoName }) };

      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'toggle_automation',
          targetId: auto.id,
          targetName: auto.name,
          payload: { enabled },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.toggle_automation_confirmation', language, { name: auto.name, enabled }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // 3. Edit Scene (Add/Remove)
    // Agrega [device] a la escena [X]
    const addActionMatch = normalized.match(/(?:agrega|add) (.+) (?:a la escena|to the scene) (.+)/i);
    if (addActionMatch) {
      const deviceName = addActionMatch[1].trim();
      const sceneName = addActionMatch[2].trim();

      const scenes = await this.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(sceneName));
      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: sceneName }) };

      const devices = await this.permissionGate.getAuthorizedDevices(userId);
      const device = devices.find(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(deviceName));
      if (!device) return { type: 'answer', message: getAssistantResponseText('management.device_not_found', language, { name: deviceName }) };

      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'edit_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { mode: 'add', deviceId: device.id, deviceName: device.name, command: 'turn_off' },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.add_device_confirmation', language, { deviceName: device.name, sceneName: scene.name }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // Quita [device] de la escena [X]
    const removeActionMatch = normalized.match(/(?:quita|remove) (.+) (?:de la escena|from the scene) (.+)/i);
    if (removeActionMatch) {
      const deviceName = removeActionMatch[1].trim();
      const sceneName = removeActionMatch[2].trim();

      const scenes = await this.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(sceneName));
      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: sceneName }) };

      const devices = await this.permissionGate.getAuthorizedDevices(userId);
      const device = devices.find(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(deviceName));
      const action = scene.actions.find(a => a.deviceId === device?.id || a.deviceId === deviceName);

      if (!action) return { type: 'answer', message: getAssistantResponseText('management.device_not_in_scene', language, { name: deviceName }) };

      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'edit_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { mode: 'remove', deviceId: action.deviceId, deviceName: device?.name || deviceName },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.remove_device_confirmation', language, { deviceName: device?.name || deviceName, sceneName: scene.name }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    return { type: 'answer', message: getAssistantResponseText('management.unsupported_action', language, {}) };
  }

  private async executeManagementAction(
    action: NonNullable<AssistantMemoryState['pendingManagementAction']>,
    userId: string,
    language: string
  ): Promise<AssistantConversationResponse> {
    const { type, targetId, payload } = action;

    try {
      if (type === 'rename_scene') {
        const newName = typeof payload['newName'] === 'string' ? payload['newName'] : undefined;
        if (!newName) throw new Error('INVALID_PAYLOAD: newName is required');

        const scene = await this.sceneRepository.findSceneById(targetId);
        if (scene) {
          scene.name = newName;
          scene.updatedAt = new Date().toISOString();
          await this.sceneRepository.saveScene(scene);
          await this.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.scene_renamed', language, { name: scene.name }) };
        }
      }

      if (type === 'toggle_automation') {
        const enabled = typeof payload['enabled'] === 'boolean' ? payload['enabled'] : undefined;
        if (enabled === undefined) throw new Error('INVALID_PAYLOAD: enabled is required');

        const auto = await this.automationRepository.findById(targetId);
        if (auto) {
          const updatedAuto = { ...auto, enabled, updatedAt: new Date().toISOString() };
          await this.automationRepository.save(updatedAuto);
          await this.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.automation_toggled', language, { name: auto.name, enabled }) };
        }
      }

      if (type === 'edit_scene') {
        const mode = payload['mode'];
        const deviceId = typeof payload['deviceId'] === 'string' ? payload['deviceId'] : undefined;

        if (mode === 'add') {
          const command = payload['command'];
          if (!deviceId || typeof command !== 'string' || !isValidCommand(command)) {
            throw new Error('INVALID_PAYLOAD: deviceId and valid command are required for add mode');
          }
          const scene = await this.sceneRepository.findSceneById(targetId);
          if (scene) {
            scene.actions.push({
              deviceId,
              command: { name: command, params: {} }
            });
            scene.updatedAt = new Date().toISOString();
            await this.sceneRepository.saveScene(scene);
            await this.clearPendingAction(userId);
            return { type: 'answer', message: getAssistantResponseText('management.scene_updated', language, { name: scene.name }) };
          }
        } else if (mode === 'remove') {
          if (!deviceId) throw new Error('INVALID_PAYLOAD: deviceId is required for remove mode');
          const scene = await this.sceneRepository.findSceneById(targetId);
          if (scene) {
            scene.actions = scene.actions.filter(a => a.deviceId !== deviceId);
            scene.updatedAt = new Date().toISOString();
            await this.sceneRepository.saveScene(scene);
            await this.clearPendingAction(userId);
            return { type: 'answer', message: getAssistantResponseText('management.scene_updated', language, { name: scene.name }) };
          }
        }
      }

      return { type: 'error', message: getAssistantResponseText('management.execution_failed', language, {}) };
    } catch (err: unknown) {
      return { type: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  }

  private buildCommandSuccessMessage(command: DeviceCommandV1, deviceName: string, _userName: string | null, language: string): string {
    if (language === 'en') {
      const verb = command === 'turn_on' ? 'Turned on' : (command === 'turn_off' ? 'Turned off' : 'Controlled');
      return `${verb} ${deviceName}.`;
    } else {
      const verb = command === 'turn_on' ? 'Encendí' : (command === 'turn_off' ? 'Apagué' : 'Controlé');
      return `${verb} ${deviceName}.`;
    }
  }

  private formatMultiCommandSummary(results: ExecutedCommandResult[], language: string, bulkType?: 'all' | 'lights'): string {
    const isEn = language === 'en';
    const successes = results.filter(r => r.result.status === 'success');
    const failures = results.filter(r => r.result.status === 'failed');

    if (failures.length === 0) {
      if (results.length === 1) {
        const r = results[0];
        if (isEn) {
          const verb = r.action.command === 'turn_on' ? 'Turned on' : (r.action.command === 'turn_off' ? 'Turned off' : 'Controlled');
          return `${verb} ${r.deviceName}.`;
        } else {
          const verb = r.action.command === 'turn_on' ? 'Encendí' : (r.action.command === 'turn_off' ? 'Apagué' : 'Controlé');
          return `${verb} ${r.deviceName}.`;
        }
      }

      if (results.length <= 3) {
        const names = results.map(r => r.deviceName).join(isEn ? ', ' : ', ');
        const lastIndex = names.lastIndexOf(', ');
        const formattedNames = lastIndex !== -1
          ? names.substring(0, lastIndex) + (isEn ? ' and ' : ' y ') + names.substring(lastIndex + 2)
          : names;

        if (isEn) {
          return `Done, controlled ${formattedNames} successfully.`;
        } else {
          return `Listo, controlé ${formattedNames} correctamente.`;
        }
      }

      // Compact bulk response (> 3)
      const commands = Array.from(new Set(results.map(r => r.action.command)));
      const sameCmd = commands.length === 1;
      const cmd = sameCmd ? commands[0] : 'mixed';

      const term = bulkType === 'lights'
        ? (isEn ? 'lights' : 'luces')
        : (isEn ? 'devices' : 'dispositivos');

      if (isEn) {
        if (cmd === 'turn_on') return `Done, turned on ${results.length} ${term} successfully.`;
        if (cmd === 'turn_off') return `Done, turned off ${results.length} ${term} successfully.`;
        return `Done, executed ${results.length} actions successfully.`;
      } else {
        if (cmd === 'turn_on') return `Listo, encendí ${results.length} ${term} correctamente.`;
        if (cmd === 'turn_off') return `Listo, apagué ${results.length} ${term} correctamente.`;
        return `Listo, ejecuté ${results.length} acciones correctamente.`;
      }
    }

    // Total failure
    if (successes.length === 0) {
      if (results.length === 1) {
        const error = results[0].result.actions[0]?.error || (isEn ? 'Unknown error' : 'Error desconocido');
        return isEn
          ? `Failed to control ${results[0].deviceName}: ${error}`
          : `No pude controlar ${results[0].deviceName}: ${error}`;
      }
      const failList = failures.map(f => `• ${f.deviceName}: ${f.result.actions[0]?.error || 'Error'}`).join('\n');
      return isEn
        ? `Failed to execute any actions:\n${failList}`
        : `No pude ejecutar ninguna acción:\n${failList}`;
    }

    // Partial failure
    const failList = failures.map(f => `• ${f.deviceName}: ${f.result.actions[0]?.error || 'Error'}`).join('\n');
    if (isEn) {
      return `Executed ${successes.length} of ${results.length} actions successfully. Failed:\n${failList}`;
    } else {
      return `Ejecuté ${successes.length} de ${results.length} acciones correctamente. Fallaron:\n${failList}`;
    }
  }

  private async executeAuthorizedCommand(
    userId: string,
    deviceId: string,
    command: DeviceCommandV1,
    prompt: string,
    correlationId: string,
    params?: Record<string, unknown>
  ): Promise<SceneExecutionResult> {
    const hasParams = params !== undefined && Object.keys(params).length > 0;
    if (!this.homeRepository && process.env.NODE_ENV === 'test') {
      return hasParams
        ? this.executeSingleCommand(deviceId, command, prompt, correlationId, params)
        : this.executeSingleCommand(deviceId, command, prompt, correlationId);
    }

    const device = deviceId === 'all' ? null : await this.deviceRepository.findDeviceById(deviceId);
    const homeId = deviceId === 'all'
      ? (await this.permissionGate.authorizedHomeIdsFor(userId))[0]
      : device?.homeId;

    if (!homeId) throw new Error('DEVICE_HOME_ID_NOT_FOUND');
    await this.permissionGate.assertHomeAuthorized(userId, homeId);
    return hasParams
      ? this.executeSingleCommand(deviceId, command, prompt, correlationId, params)
      : this.executeSingleCommand(deviceId, command, prompt, correlationId);
  }
  private async executeSingleCommand(deviceId: string, command: DeviceCommandV1, prompt: string, correlationId: string, params?: Record<string, unknown>): Promise<SceneExecutionResult> {
    let homeId: string | undefined;
    let roomId: string | null = null;

    if (deviceId === 'all') {
      const allDevices = await this.deviceRepository.findAll();
      homeId = allDevices[0]?.homeId;
    } else {
      const device = await this.deviceRepository.findDeviceById(deviceId);
      homeId = device?.homeId;
      roomId = device?.roomId ?? null;
    }

    if (!homeId) throw new Error('DEVICE_HOME_ID_NOT_FOUND');

    const transientScene: Scene = {
      id: `assistant-chat-transient-${Date.now()}`,
      homeId,
      roomId,
      name: `Assistant Chat: ${prompt}`,
      actions: [{
        deviceId: deviceId,
        command: { name: command, params: params ?? {} }
      }],
      executionMode: 'parallel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await this.sceneExecutionService.execute(transientScene, {
      sourceType: 'manual',
      sourceId: 'assistant',
      correlationId
    });
  }

  private containsWord(source: string, word: string): boolean {
    const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'i');
    return regex.test(source);
  }

  private async resolvePronounIntent(normalized: string, memory: AssistantMemoryState | null, language: string): Promise<Intent | { type: 'clarificationRequired'; options: Array<{ id: string; label: string; kind: 'device' | 'scene' }> } | null> {
    const patterns = [
      { regex: /(^|\s)(apagal[ao]s?|apaga esa|apaga la misma)(\s|$)/, command: 'turn_off' as const },
      { regex: /(^|\s)(enciendel[ao]s?|enciende esa|enciende la misma|prendel[ao]s?|prende esa|prende la misma)(\s|$)/, command: 'turn_on' as const },
    ];

    const match = patterns.find(p => p.regex.test(normalized));
    if (!match) return null;

    // Only resolve pronouns if the last interaction was a command (Requirement A)
    if (!memory || memory.lastQueryType !== 'command' || !memory.entities || memory.entities.length === 0) {
      return null;
    }

    if (memory.entities.length > 1) {
      // Return clarification ONLY with the entities from the last command context (Requirement A.2)
      return {
        type: 'clarificationRequired',
        options: memory.entities.map(e => ({
          id: e.id,
          label: e.name,
          kind: 'device' // Pronoun resolution always refers to devices/scenes from last command
        }))
      };
    }

    const entity = memory.entities[0];
    return {
      type: 'command',
      deviceId: entity.id,
      command: match.command,
      params: {},
      prompt: normalized
    };
  }

  private async handleExplainQuery(targetId?: string, language: string = 'es'): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const recent = await this.executionRecordRepository.findRecent(1);

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
    const device = await this.deviceRepository.findDeviceById(firstFail.deviceId);
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

  private async handleRetryQuery(request: AssistantConverseRequest, userId: string, language: string = 'es'): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const recent = await this.executionRecordRepository.findRecent(1);

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

      await this.memoryService.saveShortTermMemory(userId, {
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
      const device = await this.deviceRepository.findDeviceById(fail.deviceId);
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

        const result = await this.executeAuthorizedCommand(userId, fail.deviceId, commandName, request.prompt, correlationId);
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
      await this.clearPendingAction(userId);
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

  private isCompanyQuery(normalized: string): boolean {
    const keywords = [
      'nezu', 'nezu sas', 'nezu s.a.s.', 'nezu ecuador',
      'que es nezu', 'quien es nezu', 'qué es nezu', 'quién es nezu',
      'quien creo homepilot', 'quién creó homepilot', 'quien hizo homepilot', 'quién hizo homepilot', 'quien desarrollo homepilot', 'quién desarrolló homepilot',
      'que hace nezu', 'qué hace nezu', 'que servicios ofrece nezu', 'qué servicios ofrece nezu', 'empresa nezu',
      'what is nezu', 'who is nezu', 'who created homepilot', 'what does nezu do', 'nezu company',
      // Legacy compatibility for "Creator" queries
      'quien te creo', 'quién te creó', 'quien te hizo', 'quién te hizo', 'quien te desarrollo', 'quién te desarrolló',
      'who created you', 'who made you', 'who developed you'
    ];
    return keywords.some(k => normalized.includes(k));
  }

  private handleCompanyInfoQuery(language: string): AssistantConversationResponse {
    const isEn = language === 'en';
    const message = isEn
      ? "NEZU S.A.S. is an Ecuadorian technology company based in Cuenca, focused on transforming homes, buildings, businesses, and industrial spaces into connected, secure, efficient, and personalized environments. NEZU creates integrated systems to improve how people live and work through ecosystems like NEZU Living, NEZU Elevate, and NEZU Core. For more information about our services in automation, security, and infrastructure, visit: https://www.nezuecuador.com/"
      : "NEZU S.A.S. es una empresa ecuatoriana de tecnología con base en Cuenca, enfocada en transformar hogares, edificios, comercios e industrias en espacios conectados, seguros, eficientes y personalizados. NEZU crea sistemas integrados para mejorar la vida y el trabajo a través de ecosistemas como NEZU Living, NEZU Elevate y NEZU Core. Para más información sobre nuestros servicios de automatización, seguridad e infraestructura, visita: https://www.nezuecuador.com/";

    return {
      type: 'answer',
      message
    };
  }

  private returnWithShadow(
    prompt: string,
    userId: string,
    language: string,
    response: AssistantConversationResponse,
    responsePreference: AssistantResponsePreference = 'standard',
    allowResponsePersonalization = false,
    scheduleShadow = true
  ): AssistantConversationResponse {
    const { llmAttempted, ...publicResponse } = response;

    // Required: Any successful deterministic execution must return directly and bypass Planner V2 Shadow
    if (publicResponse.type === 'execution' || publicResponse.type === 'clarification') {
      return publicResponse;
    }

    if (publicResponse.type === 'answer' && publicResponse.execution) {
      return publicResponse;
    }

    if (scheduleShadow && !llmAttempted && this.shadowService) {
      this.shadowService.runShadow(prompt, userId, language, publicResponse).catch(() => {});
    }

    if (!allowResponsePersonalization || publicResponse.type !== 'answer') {
      return publicResponse;
    }

    return {
      ...publicResponse,
      message: applyAssistantResponsePreference(
        publicResponse.message,
        responsePreference,
        language === 'en' ? 'en' : 'es'
      )
    };
  }
  private extractTargetPhrase(prompt: string): string {
    const norm = normalizeAssistantPrompt(prompt);
    const verbs = ['prende', 'enciende', 'apaga', 'encender', 'apagar', 'activa', 'desactiva', 'abre', 'abrir', 'cierra', 'cerrar', 'turn on', 'turn off', 'open', 'close', 'toggle'];
    for (const v of verbs) {
      if (norm.startsWith(v + ' ')) return norm.substring(v.length + 1).trim();
      if (norm === v) return '';
    }
    return norm;
  }

  private isRoomBulkFastPath(prompt: string): {
    command: 'turn_on' | 'turn_off';
    roomName: string;
    bulkType: 'all' | 'lights';
  } | null {
    const normalized = prompt.toLowerCase();

    // Guard against multi-commands or exceptions which should be handled by V1 Intent Interpreter
    if (normalized.includes('menos') || normalized.includes('excepto') || normalized.includes('solo') || normalized.includes(' y ') || normalized.includes(' except ') || normalized.includes(' but ')) {
      return null;
    }

    // Standalone bulk words that must NOT be captured as a room name.
    // If the captured roomName matches one of these, no real room was specified.
    const esBulkOnlyWords = ['luces', 'todo', 'todas', 'dispositivos'];
    const enBulkOnlyWords = ['everything', 'all', 'all lights', 'all the lights', 'lights'];

    // Spanish Regex:
    // Group 1: Verb (enciende|prende|apaga|activa|desactiva)
    // Group 2: Bulk keyword — fixed set without embedded prepositions
    // Optional preposition cluster (en|el|del|de|la|las); state-qualified global light requests are rejected below.
    // Group 3: Room name (mandatory, at least one non-empty token after bulk keyword)
    const esRegex = /^(enciende|prende|apaga|activa|desactiva)\s+(todo|todas\s+las\s+luces|todas\s+las|todas|todo\s+el|todo\s+en|las\s+luces|luces)\s+(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)$/i;
    const esMatch = normalized.match(esRegex);
    if (esMatch) {
      const verb = esMatch[1].toLowerCase();
      const command = (verb === 'enciende' || verb === 'prende' || verb === 'activa') ? 'turn_on' : 'turn_off';
      const bulkKeyword = esMatch[2].toLowerCase().trim();
      const roomName = esMatch[3].trim();
      // Guard: if the captured room name is itself a bulk-only word, no room was actually given
      if (esBulkOnlyWords.includes(roomName) || /^(?:que\s+)?(?:esten|estan)\s+(?:encendidas?|prendidas?)$|^(?:encendidas?|prendidas?)$/.test(roomName)) return null;
      const bulkType = (bulkKeyword.includes('todo') || bulkKeyword === 'todas') ? 'all' : 'lights';
      return { command, roomName, bulkType };
    }

    // English Regex:
    // Group 1: Verb (turn|switch)
    // Group 2: Direction (on|off)
    // Group 3: Bulk keyword — fixed set
    // Optional preposition cluster (in|at|the|of the|of)
    // Group 4: Room name (mandatory)
    const enRegex = /^(turn|switch)\s+(on|off)\s+(everything|all\s+the\s+lights|all\s+lights|all|the\s+lights|lights)\s+(?:in\s+|at\s+|the\s+|of\s+the\s+|of\s+)?(.+)$/i;
    const enMatch = normalized.match(enRegex);
    if (enMatch) {
      const action = enMatch[2].toLowerCase();
      const command = action === 'on' ? 'turn_on' : 'turn_off';
      const bulkKeyword = enMatch[3].toLowerCase().trim();
      const roomName = enMatch[4].trim();
      // Guard: if the captured room name is itself a bulk-only word, no room was actually given
      if (enBulkOnlyWords.includes(roomName)) return null;
      const bulkType = (bulkKeyword === 'everything' || bulkKeyword === 'all') ? 'all' : 'lights';
      return { command, roomName, bulkType };
    }

    return null;
  }

  private isSingularLightRequest(normalized: string): boolean {
    const singularNouns = [
      'la luz', 'el foco', 'la lampara', 'la bombilla', 'una luz', 'un foco',
      'the light', 'the bulb', 'the lamp', 'the spotlight', 'a light'
    ];
    return singularNouns.some(n => normalized.includes(n));
  }

  private isRoomSingularLightFastPath(prompt: string): {
    command: 'turn_on' | 'turn_off';
    roomName: string;
  } | null {
    const normalized = prompt.toLowerCase();

    // Exact singular noun tokens for Spanish — 'lux' is intentionally excluded (typo).
    // Regex uses word-boundary (\b) so partial matches like 'luxury' are rejected.
    const esRegex = /^(enciende|prende|apaga|activa|desactiva)\s+(?:la\s+|el\s+|una\s+|un\s+)?\b(luz|foco|lampara|bombilla)\b\s+(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)$/i;
    const esMatch = normalized.match(esRegex);
    if (esMatch) {
       const verb = esMatch[1].toLowerCase();
       const command = (verb === 'enciende' || verb === 'prende' || verb === 'activa') ? 'turn_on' : 'turn_off';
       const roomName = esMatch[3].trim();
       return { command, roomName };
    }

    // English: exact singular nouns only
    const enRegex = /^(turn|switch)\s+(on|off)\s+(?:the\s+|a\s+)?\b(light|bulb|lamp|spotlight)\b\s+(?:in\s+|at\s+|the\s+)?(.+)$/i;
    const enMatch = normalized.match(enRegex);
    if (enMatch) {
       const action = enMatch[2].toLowerCase();
       const command = action === 'on' ? 'turn_on' : 'turn_off';
       const roomName = enMatch[4].trim();
       return { command, roomName };
    }

    return null;
  }

  private isRoomCoverFastPath(prompt: string): {
    command: 'open' | 'close';
    roomName: string;
  } | null {
    const normalized = prompt.toLowerCase();
    const spanishMatch = /^(abre|cierra)\s+(?:la\s+|el\s+|las\s+|los\s+)?(?:cortina(?:s)?|persiana(?:s)?)\s+(?:en\s+|del\s+|de\s+la\s+|de\s+el\s+|de\s+|la\s+|el\s+)?(.+)$/iu.exec(normalized);
    if (spanishMatch) {
      return {
        command: spanishMatch[1].toLowerCase() === 'abre' ? 'open' : 'close',
        roomName: spanishMatch[2].trim()
      };
    }

    const englishMatch = /^(open|close)\s+(?:the\s+)?(?:curtain(?:s)?|blind(?:s)?|cover(?:s)?)\s+(?:in\s+|at\s+|of\s+the\s+)?(.+)$/iu.exec(normalized);
    if (englishMatch) {
      return {
        command: englishMatch[1].toLowerCase() === 'open' ? 'open' : 'close',
        roomName: englishMatch[2].trim()
      };
    }

    return null;
  }

  private async handleRoomCoverFastPath(
    userId: string,
    command: 'open' | 'close',
    roomName: string,
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>,
    userName: string | null,
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    const [devices, rooms] = await Promise.all([
      this.permissionGate.getAuthorizedDevices(userId),
      this.permissionGate.getAuthorizedRooms(userId)
    ]);
    const resolution = this.resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);

    if (resolution.status === 'ambiguous') {
      return { type: 'answer', message: getAssistantResponseText('state.room_ambiguous', language, {}) };
    }
    if (resolution.status !== 'resolved' || resolution.rooms.length !== 1) {
      return null;
    }

    const room = resolution.rooms[0];
    const covers = devices.filter((device) =>
      device.roomId === room.id
      && ['cover', 'blind', 'curtain', 'shutter'].includes(device.type.toLowerCase())
      && this.scopeFilter.isControllableDevice(device, command)
    );

    if (covers.length === 0) {
      return {
        type: 'answer',
        message: getAssistantResponseText('state.no_targets_in_room', language, {
          entityLabel: language === 'en' ? 'curtains' : 'cortinas',
          roomName: room.name
        })
      };
    }

    if (covers.length > 1) {
      const options = covers.map((device) => ({ id: device.id, label: device.name, kind: 'device' as const }));
      await this.memoryService.saveShortTermMemory(userId, {
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
          ? `I found multiple curtains in ${room.name}. Please choose one.`
          : `Encontré varias cortinas en ${room.name}. Elige cuál quieres controlar.`,
        clarification: {
          question: language === 'en' ? 'Which curtain do you want to control?' : '¿Cuál cortina quieres controlar?',
          options,
          pendingAction: { command, originalPrompt }
        }
      };
    }

    return await this.executeIntent({
      type: 'command',
      deviceId: covers[0].id,
      command,
      prompt: originalPrompt
    }, request, language, userId, userName, originalPrompt, null);
  }

  private async handleRoomSingularLightFastPath(
    userId: string,
    command: 'turn_on' | 'turn_off',
    roomName: string,
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    const [devices, rooms] = await Promise.all([
      this.permissionGate.getAuthorizedDevices(userId),
      this.permissionGate.getAuthorizedRooms(userId)
    ]);

    const resolution = this.resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);
    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      return await this.handleRoomSelectionForLight(resolution.rooms[0].id, command, userId, language, originalPrompt, `singular-${Date.now()}`);
    }

    return null;
  }

  private resolveRoomReference(prompt: string, rooms: ReadonlyArray<Room>, devices: ReadonlyArray<Device>, userId: string, userAliases: Record<string, string>): RoomAliasResolution {
    const normalized = normalizeAssistantPrompt(prompt);
    const candidates = [normalized];
    const stateRoomMatch = /^(?:como esta|que tal|estado de)\s+(?:la\s+|el\s+)?(.+)$/iu.exec(normalized);
    if (stateRoomMatch?.[1]) candidates.push(stateRoomMatch[1].trim());

    for (const candidate of candidates) {
      const resolution = this.resolveRoomAlias(candidate, rooms, devices, userId, userAliases);
      if (resolution.status !== 'not_found') return resolution;
    }

    return { status: 'not_found', rooms: [] };
  }

  private resolveRoomAlias(roomName: string, rooms: ReadonlyArray<Room>, devices: ReadonlyArray<Device>, userId: string, userAliases: Record<string, string>): RoomAliasResolution {
    const normPromptRoom = normalizeAssistantPrompt(roomName);
    const roomEntries = rooms.map(r => ({ room: r, norm: normalizeAssistantPrompt(r.name) }));

    // Priority 1: Exact Match (normalized equality)
    const exactMatches = roomEntries.filter(e => e.norm === normPromptRoom);
    if (exactMatches.length === 1) return { status: 'resolved', rooms: [exactMatches[0].room] };
    if (exactMatches.length > 1) {
      const candidates = exactMatches.map(e => e.room.name);
      console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'exact', candidateCount: candidates.length })}`);
      return { status: 'ambiguous', rooms: [], candidates };
    }

    // Priority 2: Fuzzy Match (includes both ways)
    const fuzzyMatches = roomEntries.filter(e => e.norm.includes(normPromptRoom) || normPromptRoom.includes(e.norm));
    if (fuzzyMatches.length === 1) return { status: 'resolved', rooms: [fuzzyMatches[0].room] };
    if (fuzzyMatches.length > 1) {
      const candidates = fuzzyMatches.map(e => e.room.name);
      console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'fuzzy', candidateCount: candidates.length })}`);
      return { status: 'ambiguous', rooms: [], candidates };
    }

    // Priority 3: User-defined alias (NEW)
    const normUserAliases = Object.entries(userAliases).map(([alias, targetId]) => ({
      norm: normalizeAssistantPrompt(alias),
      targetId
    }));

    const userAliasMatches = normUserAliases.filter(a =>
      normPromptRoom === a.norm || normPromptRoom.includes(a.norm)
    );

    if (userAliasMatches.length > 0) {
      // Find longest match
      let longestMatchLen = 0;
      userAliasMatches.forEach(m => { if (m.norm.length > longestMatchLen) longestMatchLen = m.norm.length; });

      const bestMatches = userAliasMatches.filter(m => m.norm.length === longestMatchLen);

      if (bestMatches.length === 1) {
        const targetId = bestMatches[0].targetId;
        const room = rooms.find(r => r.id === targetId);
        if (room) {
          console.info(`[ASSISTANT_USER_ALIAS_RESOLVED] ${JSON.stringify({ targetId })}`);
          return { status: 'resolved', rooms: [room] };
        } else {
          // If target is not a room, check if it's a device. If it's a device, we ignore it here (room context)
          // but if it's neither, we log invalid.
          const isDevice = devices.some(d => d.id === targetId);
          if (!isDevice) {
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, targetId, reason: 'entity_not_found' })}`);
          }
        }
      } else {
        const candidateNames = bestMatches.map(m => {
          const r = rooms.find(room => room.id === m.targetId);
          return r?.name || m.targetId;
        });
        console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ type: 'user_alias', candidateCount: candidateNames.length })}`);
        return { status: 'ambiguous', rooms: [], candidates: candidateNames };
      }
    }

    // Priority 4: (DELETED) Built-in aliases are no longer supported.
    // Use user-defined aliases or exact room names.

    return { status: 'not_found', rooms: [] };
  }

  private async handleRoomBulkFastPath(
    userId: string,
    command: 'turn_on' | 'turn_off',
    roomName: string,
    bulkType: 'all' | 'lights',
    language: string,
    userAliases: Record<string, string>
  ): Promise<AssistantConversationResponse> {
    const [devices, rooms] = await Promise.all([
      this.permissionGate.getAuthorizedDevices(userId),
      this.permissionGate.getAuthorizedRooms(userId)
    ]);

    console.info(`[ASSISTANT_USER_ALIAS_LOOKUP] ${JSON.stringify({ userId, aliasCount: Object.keys(userAliases).length, requestedRoomLength: roomName.length })}`);
    const resolution = this.resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);

    if (resolution.status === 'ambiguous') {
      const list = resolution.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible rooms: ${list}. Which one do you want to use?`
          : `Encontré varias estancias posibles: ${list}. ¿Cuál quieres usar?`
      };
    }

    if (resolution.status === 'not_found' || resolution.rooms.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "I didn't find that room."
          : "No encontré esa estancia."
      };
    }

    const matchingRooms = resolution.rooms;
    const targetRoomIds = matchingRooms.map(r => r.id);
    const displayRoomName = matchingRooms[0].name;

    const matchingDevices = devices.filter(d => {
      const isInRoom = d.roomId && targetRoomIds.includes(d.roomId);
      if (!isInRoom) return false;
      // Same "only devices that actually need the change" filter as the global
      // bulk fast-path, so "apaga todo en la sala" and "apaga todo" behave consistently.
      return this.scopeFilter.isControllableForBulk(d, command, bulkType) && this.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (matchingDevices.length === 0) {
      const deviceTerm = bulkType === 'lights'
        ? (language === 'en' ? 'lights' : 'luces')
        : (language === 'en' ? 'controllable devices' : 'dispositivos controlables');
      return {
        type: 'answer',
        message: language === 'en'
          ? `I didn't find any ${deviceTerm} in ${displayRoomName}.`
          : `No encontré ${deviceTerm} en ${displayRoomName}.`
      };
    }

    const deviceIds = matchingDevices.map(l => l.id);

    // Bulk/room-scale actions always require explicit confirmation, in chat and in
    // voice alike — interactionMode must never skip this gate (security requirement).

    console.info(`[ASSISTANT_BULK_CONFIRMATION_REQUIRED] ${JSON.stringify({
      source: "room_bulk_fast_path",
      room: displayRoomName,
      count: matchingDevices.length,
      command,
      bulkType
    })}`);

    await this.createConfirmationTicket(userId, matchingDevices[0].homeId, command, deviceIds, `Bulk room action for ${displayRoomName}`, bulkType);

    const deviceTerm = bulkType === 'lights'
      ? (language === 'en' ? 'lights' : 'luces')
      : (language === 'en' ? 'devices' : 'dispositivos');

    const actionText = command === 'turn_on'
      ? (language === 'en' ? 'turn them on' : 'encenderlos')
      : (language === 'en' ? 'turn them off' : 'apagarlos');

    // For Spanish, "encenderlas/apagarlas" if it's "luces", "encenderlos/apagarlos" if it's "dispositivos"
    const actionTextFinal = language === 'es' && bulkType === 'lights'
      ? actionText.replace('los', 'las')
      : actionText;

    return {
      type: 'clarification',
      message: language === 'en'
        ? `I found ${matchingDevices.length} ${deviceTerm} in ${displayRoomName}. Do you confirm you want to ${actionText}?`
        : `Encontré ${matchingDevices.length} ${deviceTerm} en ${displayRoomName}. ¿Confirmas que quieres ${actionTextFinal}?`
    };
  }

  private isBulkFastPath(normalized: string): { command: 'turn_on' | 'turn_off', bulkType: 'all' | 'lights' } | null {
    // Exclusion syntax must go through multi-command parser, not bulk fast-path.
    const exclusionWords = ['menos', 'excepto', 'salvo', 'except', 'minus'];
    if (exclusionWords.some(word => normalized.includes(word))) return null;

    const offVerbs = ['apaga', 'apagar', 'apagues', 'apaguen', 'desactiva', 'desactivar', 'desactives', 'desconecta', 'desconectar'];
    const onVerbs = ['prende', 'prender', 'prendas', 'enciende', 'encender', 'enciendas', 'activa', 'activar', 'actives'];
    const words = normalized.split(' ');
    const hasPassiveOffRequest = /^(apagado|apagada|apagados|apagadas)\s+(todo|todas? las luces)\b/.test(normalized)
      || /^(deja|dejes|dejar|mantiene|mantener)\s+.*\bapagadas?\b/.test(normalized);
    const hasPassiveOnRequest = /^(encendido|encendida|encendidos|encendidas)\s+(todo|todas? las luces)\b/.test(normalized)
      || /^(deja|dejes|dejar|mantiene|mantener)\s+.*\bencendidas?\b/.test(normalized);
    const hasOffCommand = offVerbs.some(verb => words.includes(verb)) || hasPassiveOffRequest || /\bturn off\b/.test(normalized);
    const hasOnCommand = onVerbs.some(verb => words.includes(verb)) || hasPassiveOnRequest || /\bturn on\b/.test(normalized);
    if (hasOffCommand === hasOnCommand) return null;

    const hasGlobalScope = /\b(todo|everything)\b|\btoda la casa\b|\bcasa (completa|entera)\b|\bhogar (completo|entero)\b|\bwhole house\b/.test(normalized);
    const targetsLights = /\b(luz|luces|iluminacion|lampara|lamparas|light|lights)\b/.test(normalized);
    const targetsAllLights = /\btodas? las luces\b|\blas luces que esten encendidas\b|\ball (the )?lights\b|\bthe lights that are on\b/.test(normalized);
    if (!hasGlobalScope && !targetsAllLights) return null;

    return {
      command: hasOffCommand ? 'turn_off' : 'turn_on',
      bulkType: targetsLights ? 'lights' : 'all'
    };
  }
  private async handleBulkFastPath(normalized: string, bulkType: 'all' | 'lights', command: 'turn_on' | 'turn_off', language: string, userId: string, interactionMode: 'chat' | 'voice' = 'chat'): Promise<AssistantConversationResponse | null> {
    const allDevices = await this.permissionGate.getAuthorizedDevices(userId);

    const targetDevices = allDevices.filter(d => {
      return this.scopeFilter.isControllableForBulk(d, command, bulkType) && this.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (targetDevices.length === 0) {
      const deviceTerm = bulkType === 'lights'
        ? (language === 'en' ? 'lights' : 'luces')
        : (language === 'en' ? 'controllable devices' : 'dispositivos controlables');
      return {
        type: 'answer',
        message: language === 'en'
          ? `I didn't find any ${deviceTerm}.`
          : `No encontré ${deviceTerm}.`
      };
    }

    const deviceIds = targetDevices.map(d => d.id);
    console.info(`[ASSISTANT_BULK_CONFIRMATION_REQUIRED] ${JSON.stringify({
      source: 'bulk_fast_path',
      count: targetDevices.length,
      command,
      bulkType
    })}`);

    await this.createConfirmationTicket(userId, targetDevices[0].homeId, command, deviceIds, normalized, bulkType);

    const deviceTerm = bulkType === 'lights'
      ? (language === 'en' ? 'lights' : 'luces')
      : (language === 'en' ? 'devices' : 'dispositivos');

    const isOff = command === 'turn_off';
    const actionText = isOff
      ? (language === 'en' ? 'turn them all off' : 'apagarlos todos')
      : (language === 'en' ? 'turn them all on' : 'encenderlos todos');

    // For Spanish, "apagarlas/encenderlas" if it's "luces"
    const actionTextFinal = language === 'es' && bulkType === 'lights'
      ? actionText.replace('los', 'las').replace('todos', 'todas')
      : actionText;

    return {
      type: 'clarification',
      message: language === 'en'
        ? `I found ${targetDevices.length} ${deviceTerm}. Do you confirm you want to ${actionText}?`
        : `Encontré ${targetDevices.length} ${deviceTerm}. ¿Confirmas que quieres ${actionTextFinal}?`
    };
  }

  private async attemptDeviceAliasFastPathExecution(activePrompt: string, userId: string, language: string, aliases: Record<string, string>): Promise<AssistantConversationResponse | null> {
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

    const devices = await this.permissionGate.getAuthorizedDevices(userId);
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

    const match = this.aliasManagementService.findBestAliasMatch(targetPhrase, deviceAliases);

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
    const execResult = await this.executeAuthorizedCommand(userId, targetDevice.id, command, activePrompt, `alias-fastpath-${Date.now()}`);

    if (execResult.status === 'success') {
      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: targetDevice.id, name: targetDevice.name, type: targetDevice.type, roomId: targetDevice.roomId }],
        timestamp: new Date().toISOString()
      });
      console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ source: 'device_alias', deviceId: targetDevice.id })}`);

      return await this.attachSuggestionIfNeeded({
        type: 'execution',
        message: language === 'en'
          ? `I've ${command === 'turn_on' ? 'turned on' : command === 'turn_off' ? 'turned off' : 'toggled'} ${match.alias}.`
          : `He ${command === 'turn_on' ? 'encendido' : command === 'turn_off' ? 'apagado' : 'alternado'} ${match.alias}.`,
        execution: execResult
      }, userId, language, null, 'command');
    }

    return null;
  }

  private async attemptFastPathExecution(activePrompt: string, userId: string, language: string, userName: string | null): Promise<AssistantConversationResponse | null> {
    const devices = await this.permissionGate.getAuthorizedDevices(userId);
    const result = this.fastPathResolver.resolve(activePrompt, Array.from(devices));
    if (!result) return null;

    const device = devices.find((d) => d.id === result.deviceId);
    if (!device) return null;
    if (!this.scopeFilter.isControllableDevice(device, result.command, result.params)) return null;

    const execResult = await this.executeAuthorizedCommand(userId, result.deviceId, result.command, activePrompt, `fastpath-${Date.now()}`, result.params);

    if (execResult.status === 'success') {
      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }],
        timestamp: new Date().toISOString()
      });
      console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ source: 'fast_path', deviceId: device.id, deviceName: device.name })}`);

      const isSpanish = language === 'es';
      let msg = '';
      if (result.command === 'turn_on') msg = isSpanish ? `Hecho, encendí ${device.name}.` : `Done, turned on ${device.name}.`;
      else if (result.command === 'turn_off') msg = isSpanish ? `Hecho, apagué ${device.name}.` : `Done, turned off ${device.name}.`;
      else if (result.command === 'open') msg = isSpanish ? `Hecho, abrí ${device.name}.` : `Done, opened ${device.name}.`;
      else if (result.command === 'close') msg = isSpanish ? `Hecho, cerré ${device.name}.` : `Done, closed ${device.name}.`;
      else msg = isSpanish ? `Hecho, alterné ${device.name}.` : `Done, toggled ${device.name}.`;

      return await this.attachSuggestionIfNeeded(this.withJarvisStyle({
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

  private async attemptV2HybridExecution(
    activePrompt: string,
    userId: string,
    language: 'es' | 'en',
    userName: string | null,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse | null> {
    if (!this.shadowService) return null;

    const v2Result = await this.shadowService.attemptHybridExecution(activePrompt, userId, memory);
    if (!v2Result) return null;

    // Multi-Target Guard
    if ((v2Result.resolvedIds && v2Result.resolvedIds.length > 1) || v2Result.resolvedType === 'category') {
      console.info(`[ASSISTANT_CONFIRMATION_REQUIRED] ${JSON.stringify({ count: v2Result.resolvedIds?.length ?? 0, command: v2Result.command, resolvedType: v2Result.resolvedType })}`);

      const resolvedIds = v2Result.resolvedIds || [];
      const firstDevice = resolvedIds[0] ? await this.deviceRepository.findDeviceById(resolvedIds[0]) : null;
      if (firstDevice) {
        await this.createConfirmationTicket(
          userId,
          firstDevice.homeId,
          v2Result.command as ConfirmationTicketCommand,
          resolvedIds,
          activePrompt
        );
      }

      return {
        type: 'clarification',
        message: language === 'en'
          ? `I found ${v2Result.resolvedIds?.length} devices. Do you confirm you want to execute this action?`
          : `Encontré ${v2Result.resolvedIds?.length} dispositivos. ¿Confirmas que quieres ejecutar esta acción?`
      };
    }

    if (!v2Result.deviceId) return null;

    // Bypass V1 execution completely
    const device = await this.deviceRepository.findDeviceById(v2Result.deviceId);
    const deviceName = device?.name ?? v2Result.deviceId;

    const execResult = await this.executeAuthorizedCommand(userId, v2Result.deviceId, v2Result.command as DeviceCommandV1, activePrompt, `hybrid-${Date.now()}`);

    if (execResult.status === 'success') {
      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: device ? [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }] : [],
        timestamp: new Date().toISOString()
      });
      if (device) {
        console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ deviceId: device.id, deviceName: device.name })}`);
      }
    }

    return {
      type: 'execution',
      message: execResult.status === 'success'
        ? this.buildCommandSuccessMessage(v2Result.command as DeviceCommandV1, deviceName, userName, language)
        : getAssistantResponseText('execution.failed', language, {}),
      execution: execResult
    };
  }

  private async attemptContextRoomFastPathExecution(
    prompt: string,
    sourceRoomId: string | undefined,
    userId: string,
    userName: string | null,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    if (!sourceRoomId) return null;

    const normalized = normalizeAssistantPrompt(prompt);
    const vagueMatch = this.isVagueLightCommand(normalized, language);
    if (!vagueMatch) return null;

    // 2. Explicit target guard (MANDATORY)
    const [rooms, devices] = await Promise.all([
      this.permissionGate.getAuthorizedRooms(userId),
      this.permissionGate.getAuthorizedDevices(userId)
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
    const lights = roomDevices.filter(d => this.scopeFilter.isLightEntity(d) && this.scopeFilter.isDeviceAvailable(d));

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

      await this.memoryService.saveShortTermMemory(userId, {
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
    const execResult = await this.executeAuthorizedCommand(userId, selectedLight.id, vagueMatch.command, prompt, `context-${Date.now()}`);

    if (execResult.status === 'success') {
      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
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

      console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({
        source: 'context_room',
        deviceId: selectedLight.id,
        deviceName: selectedLight.name,
        roomId: targetRoom.id,
        roomName: targetRoom.name
      })}`);

      const msg = this.buildCommandSuccessMessage(vagueMatch.command, selectedLight.name, userName, language);

      return {
        type: 'execution',
        message: msg,
        execution: execResult
      };
    }

    return null;
  }

  private isVagueLightCommand(normalized: string, language: string): { command: DeviceCommandV1 } | null {
    const isEs = language === 'es';
    if (isEs) {
      if (normalized === 'prende la luz' || normalized === 'enciende la luz' || normalized === 'prende luces' || normalized === 'enciende luces') return { command: 'turn_on' };
      if (normalized === 'apaga la luz' || normalized === 'apaga luces') return { command: 'turn_off' };
    } else {
      if (normalized === 'turn on the light' || normalized === 'turn on lights') return { command: 'turn_on' };
      if (normalized === 'turn off the light' || normalized === 'turn off lights') return { command: 'turn_off' };
    }
    return null;
  }

}



