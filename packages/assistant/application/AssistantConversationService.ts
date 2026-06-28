import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
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
import { resolveCapabilitiesForDevice } from '../../devices/domain/CapabilityResolver';
import { validateDeviceCommand } from '../../devices/domain/CommandCapabilityValidator';
import { Room } from '../../topology/domain/types';
import type { Intent, MultiCommandAction, IntentInterpreterPort } from './ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import { AssistantMemoryPort, AssistantMemoryEntity, AssistantMemoryState } from './ports/AssistantMemoryPort';
import { FollowUpResolverPort, ResolvedFollowUp } from './ports/FollowUpResolverPort';
import { AssistantPlannerV2ShadowService } from './AssistantPlannerV2ShadowService';
import { AssistantFastPathResolver } from './AssistantFastPathResolver';
import { JarvisResponseFormatter, type JarvisResponseStyle } from './response/JarvisResponseFormatter';
import { AssistantQuickResponseService } from './AssistantQuickResponseService';
import { extractNezuWakeCommand } from '../../shared/domain/nezuWakePhrases';
import { formatNaturalSpanishTime, getSpanishDayPeriod } from './NaturalDateTimeFormatter';

export interface AssistantConversationResponse {
  type: "answer" | "execution" | "clarification" | "error";
  message: string;
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

// --- LANGUAGE INTELLIGENCE V1 ---

/**
 * Deterministic language detection. No external dependencies.
 * Returns null when the prompt is ambiguous (no clear language signal).
 * Caller uses stored preference or API hint to resolve.
 */
function detectLanguage(prompt: string): 'es' | 'en' | null {
  const lower = prompt.toLowerCase();

  // B. Spanish signals (checked first — accents are unambiguous)
  const hasAccent = /[áéíóúñÁÉÍÓÚÑ]/i.test(prompt);
  const spanishWords = [
    'qué', 'quién', 'por qué', 'enciende', 'apaga', 'hola', 'por favor', 'cómo', 'dónde', 'cuándo',
    'que', 'quien', 'como', 'donde', 'cuando', 'gracias', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'si', 'no'
  ];
  const spanishPhrases = [
    'que es', 'quien es', 'como estas', 'que puedes hacer', 'que servicios', 'quien creo'
  ];

  const hasSpanishWord = spanishWords.some(w => {
    const re = new RegExp(`(^|\\s)${w}(\\s|$|[?!.,])`, 'i');
    return re.test(lower);
  });
  const hasSpanishPhrase = spanishPhrases.some(p => lower.includes(p));

  if (hasAccent || hasSpanishWord || hasSpanishPhrase) return 'es';

  // A. English signals
  const englishWords = ['the', 'turn', 'on', 'off', 'what', 'who', 'why', 'hello', 'hi', 'please', 'switch', 'answer', 'speak', 'created', 'company'];
  const isAsciiOnly = /^[a-z0-9\s.,?!'-]+$/i.test(prompt);
  const hasEnglishWord = englishWords.some(w => {
    const re = new RegExp(`(^|\\s)${w}(\\s|$|[?!.,])`, 'i');
    return re.test(lower);
  });
  if (hasEnglishWord && isAsciiOnly) return 'en';

  // C. Ambiguous — caller resolves from stored preference or API hint
  return null;
}

/**
 * Detects explicit language override commands.
 * Returns 'en', 'es', or null if no override.
 */
function isLanguageOverrideCommand(normalized: string): 'es' | 'en' | null {
  const toEnglish = [
    'habla en ingles', 'responde en ingles', 'cambia a ingles',
    'habla en inglés', 'responde en inglés', 'cambia a inglés'
  ];
  const toSpanish = [
    'speak spanish', 'answer in spanish', 'switch to spanish', 'speak in spanish'
  ];
  if (toEnglish.some(k => normalized.includes(k))) return 'en';
  if (toSpanish.some(k => normalized.includes(k))) return 'es';
  return null;
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
    private readonly shadowService?: AssistantPlannerV2ShadowService
  ) {}

  private readonly fastPathResolver = new AssistantFastPathResolver();

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
    const userName = request.userName?.trim() || null;
    const namePrefix = userName ? `${userName}, ` : '';
    const normalized = this.normalizePrompt(prompt);

    // V2: Load Contextual Memory & Aliases FIRST
    const [memory, aliases, storedLangPref] = await Promise.all([
      this.memoryService.getShortTermMemory(userId),
      this.memoryService.getAliases(userId),
      this.memoryService.getUserPreference(userId, 'preferred_language')
    ]);

    // --- LANGUAGE INTELLIGENCE V1 ---
    const langOverride = isLanguageOverrideCommand(normalized);
    if (langOverride !== null) {
      await this.memoryService.setUserPreference(userId, 'preferred_language', langOverride);
      return {
        type: 'answer',
        message: langOverride === 'en' ? "Got it. I'll speak in English from now on." : "Perfecto. A partir de ahora hablaré en español."
      };
    }
    const detectedLang = detectLanguage(prompt);
    const storedValidLang: 'es' | 'en' = storedLangPref === 'en' ? 'en' : (_langHint === 'en' ? 'en' : 'es');
    const language: 'es' | 'en' = detectedLang ?? storedValidLang;
    this.memoryService.setUserPreference(userId, 'preferred_language', language).catch(() => {});

    // --- 1. PENDING CONFIRMATIONS / SELECTED OPTION ---
    // A) Management Confirmation
    if (memory?.pendingManagementAction) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) return this.returnWithShadow(activePrompt, userId, language, await this.executeManagementAction(memory.pendingManagementAction, userId, language));
      if (isNegative) { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: language === 'en' ? "Action cancelled." : "Acción cancelada." }); }
    }

    // B) Alias Delete Confirmation
    if (memory?.pendingAliasDelete) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) { await this.memoryService.deleteAlias(userId, memory.pendingAliasDelete.alias); await this.clearPendingAction(userId); return { type: 'answer', message: language === 'en' ? `Done, I deleted the alias '${memory.pendingAliasDelete.alias}'.` : `Listo, eliminé el alias '${memory.pendingAliasDelete.alias}'.` }; }
      if (isNegative) { await this.clearPendingAction(userId); return { type: 'answer', message: language === 'en' ? "Action cancelled." : "Acción cancelada." }; }
    }

    // C) Bulk Action Confirmation
    if (memory?.pendingBulkAction) {
      const now = Date.now();
      const pendingTime = new Date(memory.pendingBulkAction.timestamp).getTime();
      if (now - pendingTime < 300000) {
        if (this.isBulkActionAccept(normalized)) return await this.handleBulkActionAccept(userId, language, memory.pendingBulkAction);
        if (this.isBulkActionReject(normalized)) return await this.handleBulkActionReject(userId, language, memory.pendingBulkAction);
      } else {
        await this.clearPendingAction(userId);
      }
    }

    // D) Draft Confirmation
    if (memory?.pendingDraft) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);
      if (isAffirmative) {
        try { await this.draftService.activateDraft(memory.pendingDraft.id, userId); await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: language === 'en' ? "Ready. Scene activated successfully. Systems aligned." : "Listo. Escena activada correctamente. Sistemas alineados." }); }
        catch (err: unknown) { return this.returnWithShadow(activePrompt, userId, language, { type: 'error', message: language === 'en' ? "Failed to activate draft." : "No se pudo activar la escena." }); }
      }
      if (isNegative) { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: language === 'en' ? "Understood, I didn't activate the scene." : "Entendido, no activé la escena." }); }
    }

    // E) Selected Option Flow (UI clicks)
    if (request.selectedOptionId) {
      if (memory?.pendingIntent && (request.selectedOptionId === 'confirm' || request.selectedOptionId === 'cancel')) {
        if (request.selectedOptionId === 'confirm') { request.confirmed = true; return this.returnWithShadow(activePrompt, userId, language, await this.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory)); }
        else { await this.clearPendingAction(userId); return this.returnWithShadow(activePrompt, userId, language, { type: 'answer', message: language === 'en' ? "Action cancelled." : "Acción cancelada." }); }
      }
      return await this.handleSelection(request, language);
    }

    // F) Natural Language Confirmations (Yes/No)
    if (this.isConfirmation(normalized)) {
      if (memory?.pendingIntent) {
        const now = Date.now();
        const pendingTime = new Date(memory.pendingIntent.timestamp).getTime();
        if (now - pendingTime < 300000) {
          if (this.isPositiveConfirmation(normalized)) { request.confirmed = true; return await this.executeIntent(memory.pendingIntent, request, language, userId, userName, memory.originalPrompt || prompt, memory); }
          else if (this.isNegativeConfirmation(normalized)) { await this.clearPendingAction(userId); return { type: 'answer', message: language === 'en' ? "Action cancelled." : "Acción cancelada." }; }
        }
      }
      const pendingSuggestion = memory?.pendingSuggestion;
      if (isPendingSuggestion(pendingSuggestion)) {
        if (this.isSuggestionAccept(normalized)) return await this.handleSuggestionAccept(userId, language, pendingSuggestion);
        if (this.isSuggestionReject(normalized)) return await this.handleSuggestionReject(userId, language, pendingSuggestion);
        if (this.isSuggestionPostpone(normalized)) return await this.handleSuggestionPostpone(userId, language, pendingSuggestion);
      }
      if (this.isPositiveConfirmation(normalized)) return { type: 'answer', message: language === 'en' ? "Confirm what? I don't have any pending actions." : "¿Confirmar qué? No tengo ninguna acción pendiente." };
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
          const selectedOption = memory.clarificationOptions.find(opt => opt.id === selectedId);
          let command = memory.pendingIntent?.type === 'command' ? memory.pendingIntent.command : undefined;
          if (!command) command = this.inferCommandFromPrompt(memory.originalPrompt || prompt) as DeviceCommandV1 | undefined;
          if (command) { request.pendingAction = { command, targetId: selectedId, originalPrompt: memory.originalPrompt || prompt }; return await this.handleSelection(request, language); }
          else {
            await this.memoryService.saveShortTermMemory(userId, { ...memory, entities: [{ id: selectedId, name: selectedOption?.label || 'Selected', type: 'device', roomId: null }], timestamp: new Date().toISOString() });
            return { type: 'answer', message: language === 'en' ? `I've selected ${selectedOption?.label}. What would you like to do with it?` : `Seleccioné ${selectedOption?.label}. ¿Qué quieres hacer con este dispositivo?` };
          }
        }
      }
    }

    // --- PRE-INTENT: PRONOUN RESOLUTION ---
    const pronounIntent = await this.resolvePronounIntent(normalized, memory, language);
    if (pronounIntent) {
      if ('type' in pronounIntent && pronounIntent.type === 'clarificationRequired') return { type: 'clarification', message: language === 'en' ? "I found several options for that. Which one do you mean?" : "Encontré varias opciones para eso. ¿A cuál te refieres?", clarification: { question: language === 'en' ? "Which one?" : "¿Cuál?", options: pronounIntent.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' })) } };
      if (isIntent(pronounIntent)) return await this.executeIntent(pronounIntent, request, language, userId, userName, prompt, memory);
    }

    // Date and time questions must be resolved before generic alias syntax such as "X es Y".
    if (this.isDateTimeQuery(normalized)) return await this.handleDateTimeQuery(normalized, language);

    // --- 3. ALIAS MANAGEMENT ---
    if (this.isAliasListQuery(normalized)) return await this.handleAliasList(userId, language);
    const meaningAlias = this.extractAliasMeaningQuery(normalized);
    if (meaningAlias) return await this.handleAliasMeaning(userId, meaningAlias, language);
    const deleteAliasReq = this.extractAliasDeleteRequest(normalized);
    if (deleteAliasReq) return await this.handleAliasDeleteRequest(userId, deleteAliasReq, language, memory);
    if (this.isAliasCreation(normalized)) return await this.handleAliasCreation(normalized, userId, language);

    activePrompt = normalized;

    // --- 4. EXACT/STRONG FAST-PATH ---
    const fastPathResponse = await this.attemptFastPathExecution(activePrompt, userId, language, userName);
    if (fastPathResponse) return fastPathResponse;

    // --- 5. ROOM LIGHT FAST-PATH ---
    const roomSingular = this.isRoomSingularLightFastPath(normalized);
    if (roomSingular) {
      const singularResponse = await this.handleRoomSingularLightFastPath(userId, roomSingular.command, roomSingular.roomName, language, prompt, aliases);
      if (singularResponse) return singularResponse;
    }

    const roomBulk = this.isRoomBulkFastPath(normalized);
    if (roomBulk) return await this.handleRoomBulkFastPath(userId, roomBulk.command, roomBulk.roomName, roomBulk.bulkType, language, aliases, request.interactionMode);

    // --- 6. GLOBAL BULK FAST-PATH ---
    const globalBulk = this.isBulkFastPath(normalized);
    if (globalBulk) { const bulkResponse = await this.handleBulkFastPath(normalized, globalBulk.bulkType, globalBulk.command, language, userId, request.interactionMode); if (bulkResponse) return bulkResponse; }

    // --- 7. DEVICE ALIAS FAST-PATH ---
    const deviceAliasFastPath = await this.attemptDeviceAliasFastPathExecution(activePrompt, userId, language, aliases);
    if (deviceAliasFastPath) return deviceAliasFastPath;

    // --- DETERMINISTIC GENERAL ROUTES ---
    if (this.isHomeSummaryQuery(normalized)) return await this.handleHomeSummary(language);
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
    const resolvedNormalized = this.normalizePrompt(activePrompt);
    if (this.isEquivalenceQuery(resolvedNormalized)) return this.handleEquivalenceQuery(language);
    if (this.isRoomQuery(resolvedNormalized)) return await this.handleRoomQuery(language);
    if (this.isDraftCreation(resolvedNormalized)) return await this.handleDraftCreation(resolvedNormalized, language, userId);
    if (this.isPointStateQuery(resolvedNormalized)) return await this.handlePointStateQuery(resolvedNormalized, language, userId);
    if (this.isStateQuery(resolvedNormalized)) return await this.handleStateQuery(resolvedNormalized, language, userName, userId, followUp.referencesMemory ? memory?.entities : undefined, request.sourceRoomId);
    if (this.isManagementIntent(resolvedNormalized)) return await this.handleManagementIntent(resolvedNormalized, userId, language);
    if (this.isListScenesIntent(resolvedNormalized)) return await this.handleListScenes(language);
    if (this.isListAutomationsIntent(resolvedNormalized)) return await this.handleListAutomations(language);
    if (this.isDetailFollowUp(resolvedNormalized) && memory?.lastQueryType === 'state_devices' && memory.entities && memory.entities.length > 0) return await this.handleDetailFollowUp(memory, language);

    if (!this.isLikelyHomeControlPrompt(resolvedNormalized)) return this.returnWithShadow(activePrompt, userId, language, await this.smallTalkService.handle(activePrompt, language, userName, userId));

    const v2Response = await this.attemptV2HybridExecution(activePrompt, userId, language, userName, memory);
    if (v2Response) return this.returnWithShadow(activePrompt, userId, language, v2Response);

    const intentResult = await this.intentInterpreter.interpret(activePrompt);
    if (intentResult && 'type' in intentResult) {
      if (intentResult.type === 'failure') return { type: 'error', message: intentResult.message };
      if (intentResult.type === 'clarificationRequired') {
        const inferredCommand = this.inferCommandFromPrompt(intentResult.originalSegment) || this.inferCommandFromPrompt(activePrompt) || 'turn_on';
        await this.memoryService.saveShortTermMemory(userId, { lastQueryType: 'clarification', entities: [], timestamp: new Date().toISOString(), clarificationOptions: intentResult.options, originalPrompt: activePrompt, pendingIntent: { type: 'command', deviceId: '', command: inferredCommand as DeviceCommandV1, prompt: activePrompt, timestamp: new Date().toISOString() } });
        const options = intentResult.options.map(opt => ({ ...opt, kind: isClarificationKind(opt.kind) ? opt.kind : 'device' }));
        return this.returnWithShadow(activePrompt, userId, language, this.withJarvisStyle({ type: 'clarification', message: language === 'en' ? `I found multiple matches for "${intentResult.originalSegment}".` : `Encontré varias opciones para "${intentResult.originalSegment}".`, clarification: { question: language === 'en' ? "Which one do you mean?" : "¿A cuál te refieres?", options } }, {
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
      if (this.isLikelyHomeControlPrompt(this.normalizePrompt(prompt))) {
        return {
          type: 'answer',
          message: language === 'en'
            ? "I did not understand that command. Give me the device and room, for example: turn off the living room light."
            : "No entendí ese comando. Indícame dispositivo y estancia, por ejemplo: apaga la luz de la sala."
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
        const allDevices = await this.deviceRepository.findAll();
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
          message: language === 'en' 
            ? `I couldn't find a device matching your request.` 
            : `No encontré un dispositivo llamado '${targetPhrase}'.`
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
            message: language === 'en' 
              ? "In which room do you want to control the light?" 
              : "¿En qué estancia quieres controlar la luz?",
            clarification: {
              question: language === 'en' ? "You can say: 'turn on the living room light'." : "Puedes decir: 'prende la luz de la sala'.",
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
        message: language === 'en' ? "I found several matching devices. Please choose the target." : "Encontré varios dispositivos compatibles. Indícame el objetivo.",
          clarification: {
            question: language === 'en' ? "Which one do you want to control?" : "¿Cuál quieres controlar?",
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
          question: language === 'en' ? "Are you sure you want to proceed?" : "¿Estás seguro de que quieres continuar?",
          options: [
            { id: 'confirm', label: language === 'en' ? "Yes, proceed" : "Sí, adelante", kind: 'device' },
            { id: 'cancel', label: language === 'en' ? "No, cancel" : "No, cancelar", kind: 'device' }
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
      if (!scene) return { type: 'error', message: language === 'en' ? "Scene not found. I need a valid scene." : "Escena no encontrada. Necesito una escena válida." };

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
        message: language === 'en' ? "Scene execution started." : "Escena en ejecución.",
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
          message: language === 'en' 
            ? `Are you sure you want to control ${deviceName}?` 
            : `¿Estás seguro de que quieres controlar ${deviceName}?` 
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
        const result = await this.executeSingleCommand(intent.deviceId, intent.command, intent.prompt, correlationId);
        
        if (result.status === 'failed') {
          this.learningService.recordCommandResult(userId, intent.deviceId, false, result.actions[0]?.error || 'Unknown error').catch(() => {});
          return this.withJarvisStyle({
            type: 'error',
            message: result.actions[0]?.userMessage || result.actions[0]?.error || (language === 'en' ? "Execution failed." : "La ejecución falló."),
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
          message: errorMessage || (language === 'en' ? "Unknown error during execution." : "Error desconocido durante la ejecución.")
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
        const confirmMsg = language === 'en'
          ? `I can execute ${intent.actions.length} actions (${actionSummary}). Confirm to proceed.`
          : `Puedo ejecutar ${intent.actions.length} acciones (${actionSummary}). Confírmame para proceder.`;
        return this.withJarvisStyle({ 
          type: 'clarification', 
          message: confirmMsg,
          clarification: {
            question: language === 'en' ? '¿Are you sure?' : '¿Estás seguro?',
            options: [
              { id: 'confirm', label: language === 'en' ? 'Yes, execute all' : 'Sí, ejecutar todo', kind: 'device' as const },
              { id: 'cancel', label: language === 'en' ? 'No, cancel' : 'No, cancelar', kind: 'device' as const }
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
          const result = await this.executeSingleCommand(action.deviceId, action.command, intent.prompt, correlationId);
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
            status: failures.length === 0 ? 'success' : 'failed',
            actions: results.flatMap(r => r.result.actions)
          }
        }, userId, language, memory, 'multi_command');

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          type: 'error',
          message: errorMessage || (language === 'en' ? "Unknown error during execution." : "Error desconocido durante la ejecución.")
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
      message: language === 'en' ? "Instruction type not recognized. Standing by for a clearer command." : "Tipo de instrucción no reconocido. Quedo atento a una orden más clara."
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
        pendingBulkAction: undefined,
        pendingAliasDelete: undefined,
        originalPrompt: undefined
      });
    }
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
    let normalized = this.normalizePrompt(text);
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
    const exactLabel = options.find(opt => this.normalizePrompt(opt.label) === normalized);
    if (exactLabel) return exactLabel.id;

    // Partial label match (e.g. "luz sala")
    const partialLabel = options.find(opt => {
      const optLabel = this.normalizePrompt(opt.label);
      return normalized.includes(optLabel) || optLabel.includes(normalized);
    });
    if (partialLabel) return partialLabel.id;

    return null;
  }
  private inferCommandFromPrompt(prompt: string): DeviceCommandV1 | undefined {
    const normalized = this.normalizePrompt(prompt);
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

  private isAliasCreation(normalized: string): boolean {
    // Patrones explícitos ES
    if (normalized.includes('cuando diga') && (normalized.includes('me refiero a') || normalized.includes('entiende'))) return true;
    if (normalized.includes('guarda') && normalized.includes('como alias')) return true;
    if (normalized.includes('crea alias')) return true;
    if (normalized.includes('llama ') && normalized.includes(' a ')) return true;
    
    const questionWords = ['que', 'qué', 'cual', 'cuál', 'como', 'cómo', 'donde', 'dónde', 'quien', 'quién'];
    const isQuestion = questionWords.some(w => normalized.startsWith(w + ' ')) || normalized.includes('?');
    if (normalized.includes(' es ') && !isQuestion) return true;

    // Patrones explícitos EN
    if (normalized.includes('when i say') && normalized.includes('i mean')) return true;
    if (normalized.includes('save') && normalized.includes('as alias')) return true;
    if (normalized.includes('create alias')) return true;
    if (normalized.includes('call ') && !normalized.includes('call me')) return true;
    if (normalized.includes(' means ')) return true;

    return false;
  }

  private async handleAliasCreation(normalized: string, userId: string, language: string): Promise<AssistantConversationResponse> {
    // 1. "cuando diga X me refiero a Y" / "when i say X i mean Y"
    const match1 = normalized.match(/(?:cuando diga|when i say) (.+) (?:me refiero a|i mean) (.+)/i);
    if (match1) {
      return await this.tryCreateAlias(userId, match1[1].trim(), match1[2].trim(), language);
    }

    // 2. "llama X a Y" (ES) / "call X to Y" or "call X as Y" (EN)
    const match2 = normalized.match(/(?:llama|call) (.+?) (?:a|to|as) (.+)/i);
    if (match2) {
      return await this.tryCreateAlias(userId, match2[1].trim(), match2[2].trim(), language);
    }

    // 3. "X es Y" / "X means Y"
    const match3 = normalized.match(/(.+) (?:es|means) (.+)/i);
    if (match3) {
      return await this.tryCreateAlias(userId, match3[1].trim(), match3[2].trim(), language);
    }

    // 4. Fallback for "call X Y" (EN)
    if (language === 'en') {
      const match4 = normalized.match(/call (.+?) (.+)/i);
      if (match4) {
        return await this.tryCreateAlias(userId, match4[2].trim(), match4[1].trim(), language);
      }
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? "I couldn't understand the alias you want to create."
        : "No pude entender el alias que quieres crear."
    };
  }

  private async tryCreateAlias(userId: string, alias: string, targetName: string, language: string): Promise<AssistantConversationResponse> {
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);
    
    // --- COLLISION GUARD ---
    const normAlias = this.normalizePrompt(alias);
    const existingRoom = rooms.find(r => this.normalizePrompt(r.name) === normAlias);
    if (existingRoom) {
      console.info(`[ASSISTANT_USER_ALIAS_COLLISION] ${JSON.stringify({ userId, alias, targetName: existingRoom.name, collisionType: 'room' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `A room or device named '${existingRoom.name}' already exists. Use another alias to avoid confusion.`
          : `Ya existe una estancia o dispositivo llamado '${existingRoom.name}'. Usa otro alias para evitar confusiones.`
      };
    }
    const existingDevice = devices.find(d => this.normalizePrompt(d.name) === normAlias);
    if (existingDevice) {
      console.info(`[ASSISTANT_USER_ALIAS_COLLISION] ${JSON.stringify({ userId, alias, targetName: existingDevice.name, collisionType: 'device' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `A room or device named '${existingDevice.name}' already exists. Use another alias to avoid confusion.`
          : `Ya existe una estancia o dispositivo llamado '${existingDevice.name}'. Usa otro alias para evitar confusiones.`
      };
    }
    
    // Check if target is a room
    const targetRoom = rooms.find(r => this.normalizePrompt(r.name) === this.normalizePrompt(targetName));
    if (targetRoom) {
      await this.memoryService.setAlias(userId, alias, targetRoom.id);
      console.info(`[ASSISTANT_USER_ALIAS_CREATED] ${JSON.stringify({ userId, alias, targetId: targetRoom.id, targetName: targetRoom.name, type: 'room' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `Perfect, now '${alias}' refers to ${targetRoom.name}.`
          : `Perfecto, ahora '${alias}' se refiere a ${targetRoom.name}.`
      };
    }

    // Check if target is a device
    const targetDevice = devices.find(d => this.normalizePrompt(d.name) === this.normalizePrompt(targetName));
    if (targetDevice) {
      await this.memoryService.setAlias(userId, alias, targetDevice.id);
      console.info(`[ASSISTANT_USER_ALIAS_CREATED] ${JSON.stringify({ userId, alias, targetId: targetDevice.id, targetName: targetDevice.name, type: 'device' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `Perfect, now '${alias}' refers to ${targetDevice.name}.`
          : `Perfecto, ahora '${alias}' se refiere a ${targetDevice.name}.`
      };
    }

    console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, alias, targetName, reason: 'target_not_found' })}`);
    return {
      type: 'answer',
      message: language === 'en'
        ? `I couldn't find a device or room named '${targetName}'.`
        : `No pude encontrar un dispositivo o estancia llamado '${targetName}'.`
    };
  }

  // --- ALIAS MANAGEMENT HANDLERS ---
  private isAliasListQuery(normalized: string): boolean {
    const listTriggersES = ['qué aliases tengo', 'que aliases tengo', 'qué nombres has aprendido', 'que nombres has aprendido', 'lista mis aliases', 'muestra mis aliases'];
    const listTriggersEN = ['what aliases do i have', 'list my aliases', 'show my aliases', 'what names have you learned'];
    return listTriggersES.some(t => normalized.includes(t)) || listTriggersEN.some(t => normalized.includes(t));
  }

  private async handleAliasList(userId: string, language: string): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);
    const aliasKeys = Object.keys(aliases);
    
    if (aliasKeys.length === 0) {
      console.info(`[ASSISTANT_USER_ALIAS_LIST] ${JSON.stringify({ userId, count: 0 })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "You haven't created any aliases yet." : "Aún no has creado aliases."
      };
    }

    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    const lines: string[] = [];
    for (const alias of aliasKeys) {
      const targetId = aliases[alias];
      let targetName = null;
      const room = rooms.find(r => r.id === targetId);
      if (room) {
        targetName = room.name;
      } else {
        const device = devices.find(d => d.id === targetId);
        if (device) targetName = device.name;
      }

      if (targetName) {
        lines.push(`• ${alias} → ${targetName}`);
      } else {
        console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, alias, targetId, reason: 'entity_not_found' })}`);
        lines.push(language === 'en' ? `• ${alias} → target not found` : `• ${alias} → objetivo no encontrado`);
      }
    }

    console.info(`[ASSISTANT_USER_ALIAS_LIST] ${JSON.stringify({ userId, count: lines.length })}`);
    const prefix = language === 'en' ? "These are the names I've learned:\n" : "Estos son los nombres que he aprendido:\n";
    return {
      type: 'answer',
      message: prefix + lines.join('\n')
    };
  }

  private extractAliasMeaningQuery(normalized: string): string | null {
    const matchES = normalized.match(/(?:qué significa|que significa|a qué se refiere|a que se refiere) (.+)/i);
    if (matchES) return matchES[1].trim();

    const matchEN = normalized.match(/(?:what does) (.+?) (?:mean|refer to)/i);
    if (matchEN) return matchEN[1].trim();

    return null;
  }

  private findBestAliasMatch(input: string, aliases: Record<string, string>): {
    alias: string;
    targetId: string;
    status: 'resolved' | 'not_found' | 'ambiguous';
    candidates?: string[];
  } {
    const normInput = this.normalizePrompt(input);
    let longestMatchLen = -1;
    let matches: Array<{ norm: string; original: string; targetId: string }> = [];

    for (const [alias, targetId] of Object.entries(aliases)) {
      const normAlias = this.normalizePrompt(alias);
      if (normInput === normAlias || normInput.includes(normAlias)) {
        matches.push({ norm: normAlias, original: alias, targetId });
        if (normAlias.length > longestMatchLen) {
          longestMatchLen = normAlias.length;
        }
      }
    }

    if (matches.length === 0) {
      return { alias: '', targetId: '', status: 'not_found' };
    }

    const bestMatches = matches.filter(m => m.norm.length === longestMatchLen);

    if (bestMatches.length === 1) {
      return { alias: bestMatches[0].original, targetId: bestMatches[0].targetId, status: 'resolved' };
    }

    return { 
      alias: '', 
      targetId: '', 
      status: 'ambiguous', 
      candidates: bestMatches.map(m => m.original) 
    };
  }

  private async handleAliasMeaning(userId: string, targetAlias: string, language: string): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);
    
    const match = this.findBestAliasMatch(targetAlias, aliases);
    
    if (match.status === 'ambiguous') {
      const list = match.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible aliases: ${list}. Which one do you want to use?`
          : `Encontré varios aliases posibles: ${list}. ¿Cuál quieres usar?`
      };
    }
    
    if (match.status === 'not_found') {
      console.info(`[ASSISTANT_USER_ALIAS_MEANING] ${JSON.stringify({ userId, alias: targetAlias, found: false })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "I didn't find that alias." : "No encontré ese alias."
      };
    }

    const matchedKey = match.alias;
    const targetId = match.targetId;
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    let targetName = null;
    const room = rooms.find(r => r.id === targetId);
    if (room) {
      targetName = room.name;
    } else {
      const device = devices.find(d => d.id === targetId);
      if (device) targetName = device.name;
    }

    if (!targetName) {
      console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, alias: matchedKey, targetId, reason: 'entity_not_found' })}`);
      return {
        type: 'answer',
        message: language === 'en' ? `• ${matchedKey} → target not found` : `• ${matchedKey} → objetivo no encontrado`
      };
    }

    console.info(`[ASSISTANT_USER_ALIAS_MEANING] ${JSON.stringify({ userId, alias: matchedKey, found: true })}`);
    return {
      type: 'answer',
      message: language === 'en'
        ? `'${matchedKey}' refers to ${targetName}.`
        : `'${matchedKey}' se refiere a ${targetName}.`
    };
  }

  private extractAliasDeleteRequest(normalized: string): string | null {
    const matchES = normalized.match(/(?:olvida|elimina|borra alias|borra el alias) (.+)/i);
    if (matchES) return matchES[1].trim();

    const matchEN = normalized.match(/(?:forget|delete alias|remove alias) (.+)|(?:delete) (.+) (?:alias)/i);
    if (matchEN) return (matchEN[1] || matchEN[2]).trim();

    return null;
  }

  private async handleAliasDeleteRequest(userId: string, targetAlias: string, language: string, memory: AssistantMemoryState | null): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);
    
    const match = this.findBestAliasMatch(targetAlias, aliases);
    
    if (match.status === 'ambiguous') {
      const list = match.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible aliases: ${list}. Which one do you want to use?`
          : `Encontré varios aliases posibles: ${list}. ¿Cuál quieres usar?`
      };
    }
    
    if (match.status === 'not_found') {
      console.info(`[ASSISTANT_USER_ALIAS_DELETE_NOT_FOUND] ${JSON.stringify({ userId, alias: targetAlias })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "I didn't find that alias." : "No encontré ese alias."
      };
    }

    const matchedKey = match.alias;
    const targetId = match.targetId;
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    let targetName = 'Unknown';
    const room = rooms.find(r => r.id === targetId);
    if (room) targetName = room.name;
    else {
      const device = devices.find(d => d.id === targetId);
      if (device) targetName = device.name;
    }

    await this.memoryService.saveShortTermMemory(userId, {
      ...(memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }),
      pendingAliasDelete: {
        alias: matchedKey,
        targetId,
        targetName,
        timestamp: new Date().toISOString()
      }
    });

    console.info(`[ASSISTANT_USER_ALIAS_DELETE_CONFIRMATION_REQUIRED] ${JSON.stringify({ userId, alias: matchedKey, targetName })}`);

    return {
      type: 'clarification',
      message: language === 'en'
        ? `Do you want me to forget the alias '${matchedKey}' for ${targetName}?`
        : `¿Quieres que olvide el alias '${matchedKey}' para ${targetName}?`,
      clarification: {
        question: language === 'en' ? 'Delete alias?' : '¿Eliminar alias?',
        options: [
          { id: 'confirm', label: language === 'en' ? 'Yes, delete' : 'Sí, eliminar', kind: 'alias_target' },
          { id: 'cancel', label: language === 'en' ? 'No, keep it' : 'No, mantener', kind: 'alias_target' }
        ]
      }
    };
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
        this.deviceRepository.findAll(),
        this.roomRepository.findAll()
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
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[DRAFT DEBUG] Room not found. Prompt: "${normalized}"`);
          console.debug(`[DRAFT DEBUG] Available rooms:`, allRooms.map((r: Room) => ({ id: r.id, name: r.name })));
        }
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find the room specified. You can ask me "what rooms do you know".`
            : `No encontré la estancia especificada. Puedes preguntarme "qué estancias conoces".`
        };
      }

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DRAFT DEBUG] room selected:', { id: selectedRoom.id, name: selectedRoom.name });
        console.debug('[DRAFT DEBUG] all devices:', devices.map((d: Device) => ({
          id: d.id, name: d.name, type: d.type, roomId: d.roomId,
          integrationSource: d.integrationSource,
          capsCount: d.capabilities?.length ?? 'none',
          state: d.lastKnownState
        })));
      }

      // --- Filter: devices in this room (strict roomId equality, null-safe) ---
      const roomDevices = devices.filter((d: Device) => d.roomId != null && d.roomId === selectedRoom!.id);

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DRAFT DEBUG] roomDevices count:', roomDevices.length);
        if (roomDevices.length === 0) {
          const deviceRoomIds = [...new Set(devices.map((d: Device) => d.roomId))];
          console.debug('[DRAFT DEBUG] all device roomIds in DB:', deviceRoomIds);
        }
      }

      if (roomDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I found the room "${selectedRoom.name}", but no devices are assigned to it.`
            : `Encontré la estancia "${selectedRoom.name}", pero ningún dispositivo está asignado a ella.`
        };
      }

      // --- Filter: controllable devices ---
      const controllableDevices = roomDevices.filter((d: Device) => this.isControllableDevice(d, command));

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DRAFT DEBUG] controllableDevices count:', controllableDevices.length);
        if (controllableDevices.length === 0) {
          console.debug('[DRAFT DEBUG] non-controllable device details:',
            roomDevices.map((d: Device) => {
              const caps = resolveCapabilitiesForDevice(d);
              return { name: d.name, type: d.type, caps: caps.map(c => c.type), state: d.lastKnownState?.['state'] };
            })
          );
        }
      }

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
  private isDeviceAvailable(device: Device): boolean {
    return device.lastKnownState?.state !== 'unavailable';
  }

  private supportsCommand(device: Device, command: DeviceCommandV1): boolean {
    // A. Priority: Capability Validation
    const validation = validateDeviceCommand(device, { name: command, params: {} });
    if (validation.valid) return true;

    // B. Fallback: Known controllable domain types if capabilities missing/incomplete
    const type = device.type.toLowerCase();
    const CONTROLLABLE_TYPES = ['light', 'switch', 'outlet', 'dimmer'];
    const isKnownType = CONTROLLABLE_TYPES.includes(type);

    if (isKnownType && ['turn_on', 'turn_off', 'toggle'].includes(command)) {
      return true;
    }

    const COVER_COMMANDS = ['open', 'close', 'stop', 'set_position'];
    if (type === 'cover' && COVER_COMMANDS.includes(command)) {
      return true;
    }

    return false;
  }

  private isLightEntity(device: Device): boolean {
    // Priority 1: User-assigned semantic classification (overrides hardware type)
    if (device.semanticType === 'light') return true;
    if (device.semanticType != null && device.semanticType !== 'unknown') {
      // Any other explicit semanticType means it's NOT a light
      return false;
    }

    // Priority 2: Capability-based detection
    const caps = resolveCapabilitiesForDevice(device);
    if (caps.some(c => c.type === 'light' || c.type === 'dimmer')) return true;

    // Priority 3: Hardware device.type fallback
    if (['light', 'dimmer'].includes(device.type.toLowerCase())) return true;

    // Priority 4: Conservative fallback for HA switches with an explicit light name.
    // Manual semantic classification above always takes precedence.
    const normalizedName = this.normalizePrompt(device.name);
    return /^(luz|luces|lampara|lamparas|foco|focos)(\s|$)/.test(normalizedName);
  }

  private isControllableForBulk(device: Device, command: DeviceCommandV1, bulkType: 'all' | 'lights'): boolean {
    if (!this.isDeviceAvailable(device)) return false;
    if (!this.supportsCommand(device, command)) return false;

    // Exclude sensors/cameras even if they somehow report turn_on/off support
    const type = device.type.toLowerCase();
    if (['sensor', 'binary_sensor', 'camera'].includes(type)) return false;

    // Exclude covers/blinds/curtains for turn_on/turn_off
    if (['cover', 'blind', 'curtain', 'shutter'].includes(type) && (command === 'turn_on' || command === 'turn_off')) {
      return false;
    }

    if (bulkType === 'lights') {
      return this.isLightEntity(device);
    }

    return true;
  }

  private isControllableDevice(device: Device, command: DeviceCommandV1): boolean {
    if (!this.isDeviceAvailable(device)) return false;

    // Always exclude pure sensors/cameras — these are never controllable
    const type = device.type.toLowerCase();
    if (['sensor', 'binary_sensor', 'camera'].includes(type)) return false;

    return this.supportsCommand(device, command);
  }


  private isRoomQuery(normalized: string): boolean {
    const triggers = [
      "que estancias conoces", "que estancia conoces", "que estancia nomas conoces",
      "que cuartos conoces", "que habitaciones tienes", "que zonas conoces",
      "what rooms do you know", "what areas do you know", "list rooms"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private async handleRoomQuery(language: string): Promise<AssistantConversationResponse> {
    const rooms = await this.roomRepository.findAll();
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
      return { type: 'error', message: language === 'en' ? "Missing target for selection." : "Falta el objetivo para la selección." };
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
          : (language === 'en' ? "Execution failed." : "La ejecución falló."),
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
      
      const result = await this.executeSingleCommand(targetId, command, originalPrompt, correlationId);
      
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
          : (language === 'en' ? "Execution failed." : "La ejecución falló."),
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
      message: language === 'en' ? "Invalid selection or pending action." : "Selección o acción pendiente inválida." 
    };
  }

  private normalizePrompt(prompt: string): string {
    let normalized = prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[¿?¡!.,]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")            // Normalize spaces
      .trim();

    // Fix common typos
    normalized = normalized
      .replace(/\bcomoe stas\b/g, "como estas")
      .replace(/\bcomo stas\b/g, "como estas")
      .replace(/\bcm estas\b/g, "como estas")
      .replace(/\bq tal\b/g, "que tal")
      .replace(/\bk tal\b/g, "que tal")
      .replace(/\bapagues\b/g, "apaga")
      .replace(/\benciendas\b/g, "enciende")
      .replace(/\bprendas\b/g, "prende")
      .replace(/\ba\s+pagar\b/g, "apagar")
      .replace(/\ba\s+paga\b/g, "apaga")
      .replace(/\ba\s+pa\b/g, "apaga")
      .replace(/\bapage\b/g, "apaga")
      .replace(/\bla\s+luz\s+a\s+la\s+sala\b/g, "la luz de la sala")
      .replace(/\b(el|la)\s+luceje\b/g, "luces")
      .replace(/\bluceje\b/g, "luces")
      .replace(/\bluseje\b/g, "luces")
      .replace(/\bsentidas\b/g, "encendidas")
      .replace(/\bsendidas\b/g, "encendidas")
      .replace(/\bluces\s+esta\s+en\s+encendidas\b/g, "luces estan encendidas")
      .replace(/\bque\s+luces\s+esta\s+en\s+encendidas\b/g, "que luces estan encendidas")
      .replace(/\bensaila\b/g, "en sala")
      .replace(/\bensala\b/g, "en sala")
      .replace(/\bcierres\b/g, "cierra")
      .replace(/\babras\b/g, "abre");

    const wakeCommand = extractNezuWakeCommand(normalized);
    if (wakeCommand.activated) {
      normalized = wakeCommand.command;
    }

    // Strip conversational wrappers so intent matching works on the core request.
    const politePrefixes = [
      'oye ', 'ok ',
      'puedes ', 'puede ', 'podrias ', 'podria ', 'me puedes ', 'me podrias ',
      'me ayudas a ', 'me ayudas ', 'ayudame a ', 'ayudame ',
      'quiero que ', 'quisiera que ', 'necesito que ', 'haz que ', 'haz ',
      'por favor ', 'porfa ', 'porfis '
    ];

    let strippedPrefix = true;
    while (strippedPrefix) {
      strippedPrefix = false;
      for (const prefix of politePrefixes) {
        if (normalized.startsWith(prefix)) {
          normalized = normalized.slice(prefix.length).trim();
          strippedPrefix = true;
          break;
        }
      }
    }

    const politeSuffixes = [
      ' por favor', ' porfa', ' porfis', ' gracias'
    ];
    let strippedSuffix = true;
    while (strippedSuffix) {
      strippedSuffix = false;
      for (const suffix of politeSuffixes) {
        if (normalized.endsWith(suffix)) {
          normalized = normalized.slice(0, -suffix.length).trim();
          strippedSuffix = true;
          break;
        }
      }
    }

    return normalized;
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
      this.deviceRepository.findAll(),
      this.roomRepository.findAll(),
      this.sceneRepository.findAll(),
      this.automationRepository.findAll(),
      this.memoryService.getAliases(userId)
    ]);

    const controllableDevices = devices.filter((device: Device) => (
      this.isControllableDevice(device, 'turn_on') ||
      this.isControllableDevice(device, 'turn_off') ||
      this.isControllableDevice(device, 'toggle')
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

  private async handleHomeSummary(language: string): Promise<AssistantConversationResponse> {
    const devices = await this.deviceRepository.findAll();
    const active = devices.filter(device => device.lastKnownState?.on === true || device.lastKnownState?.state === 'on').length;
    const unavailable = devices.filter(device => !this.isDeviceAvailable(device)).length;

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
    const allDevices = await this.deviceRepository.findAll();
    const roomDevices = allDevices.filter(d => d.roomId === roomId);
    
    const roomLights = roomDevices.filter(d => this.isLightEntity(d) && this.isDeviceAvailable(d));

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
      const result = await this.executeSingleCommand(light.id, command, originalPrompt, correlationId);
      
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
        question: language === 'en' ? "Which one?" : "¿Cuál?",
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
      "que", "hay", "tengo", "luces", "dispositivos", "estado", "cuales", "donde", "quien", "cuanto", "son", "cuarto", "habitacion",
      "esas", "esos", "esa", "eso",
      "what", "whats", "which", "status", "on", "off", "where", "those", "them"
    ];
    
    const isGeneral = generalTriggers.some(q => this.containsWord(normalized, q));
    
    const isGeneralState = isGeneral && (
      hasState ||
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
      this.containsWord(normalized, "them")
    );
    
    if (!isGeneralState) return false;

    // Safety: if it contains an action verb, it's probably NOT a state query (e.g. "enciende esa")
    const actionVerbs = ['prende', 'apaga', 'enciende', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'turn on', 'turn off', 'open', 'close'];
    const hasAction = actionVerbs.some(v => this.containsWord(normalized, v));
    
    return !hasAction;
  }

  private async applySafetyGateV2(
    prompt: string,
    userId: string,
    language: 'es' | 'en',
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    const normalized = this.normalizePrompt(prompt);
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
      const rooms = await this.roomRepository.findAll();
      const isRoomMentioned = rooms.some(r => normalized.includes(this.normalizePrompt(r.name)));

      if (isOrdinal || isPronoun || isMultiCommand || isBulk || isRoomMentioned) {
        return null; // Let it pass to Follow-up resolver or Interpreter
      }

      const allMatches = await this.findMatchingDevices(prompt, userId);
      if (allMatches.length === 0) {
        // If it's a very vague "luz" or similar, maybe it's not an "unknown target" but a "vague light"
        const isVague = ['la luz', 'las luces', 'luz', 'luces', 'light', 'lights', 'the light', 'the lights'].includes(targetPhrase);
        if (!isVague) {
          // Attempt Fuzzy Matching before hard blocking
          const allDevices = await this.deviceRepository.findAll();
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

          console.info(`[ASSISTANT_SAFETY_GATE_BLOCK] Unknown target: "${targetPhrase}"`);
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
      const rooms = await this.roomRepository.findAll();
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
    if (this.isAliasCreation(normalized)) return false;
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

  private async handleBulkActionAccept(userId: string, language: string, action: { deviceIds: string[], command: string, originalPrompt: string, bulkType?: 'all' | 'lights' }): Promise<AssistantConversationResponse> {
    const memory = await this.memoryService.getShortTermMemory(userId);
    const allowedCommands = ['turn_on', 'turn_off', 'toggle'];
    if (!allowedCommands.includes(action.command)) {
      console.warn(`[ASSISTANT_BULK_EXECUTION_INVALID] {"command":"${action.command}"}`);
      await this.clearPendingAction(userId);
      return {
        type: 'error',
        message: language === 'en' ? "Invalid command for bulk action." : "Comando inválido para acción en lote."
      };
    }

    console.info(`[ASSISTANT_BULK_EXECUTION_APPROVED] ${JSON.stringify({ count: action.deviceIds.length, command: action.command })}`);
    const correlationId = `bulk-${Date.now()}`;
    const results: ExecutedCommandResult[] = [];
    const entities = [];

    for (const deviceId of action.deviceIds) {
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (device) {
        const result = await this.executeSingleCommand(deviceId, action.command as DeviceCommandV1, action.originalPrompt, correlationId);
        results.push({ action: { deviceId, command: action.command as DeviceCommandV1 }, deviceName: device.name, result });
        entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
      }
    }

    await this.clearPendingAction(userId);
    
    // Save to memory so user can say "apágalas" later
    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'command',
      entities,
      timestamp: new Date().toISOString()
    });

    const summary = this.formatMultiCommandSummary(results, language, action.bulkType);
    return await this.attachSuggestionIfNeeded({
      type: 'execution',
      message: summary,
      execution: {
        sceneId: 'bulk_action',
        status: results.every(r => r.result.status === 'success') ? 'success' : 'failed',
        actions: results.flatMap(r => r.result.actions)
      }
    }, userId, language, memory, 'multi_command');
  }

  private async handleBulkActionReject(userId: string, language: string, action: { deviceIds: string[], command: string }): Promise<AssistantConversationResponse> {
    console.info(`[ASSISTANT_BULK_EXECUTION_CANCELLED] ${JSON.stringify({ count: action.deviceIds.length, command: action.command })}`);
    await this.clearPendingAction(userId);
    return {
      type: 'answer',
      message: language === 'en' ? "Action cancelled." : "Acción cancelada."
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
        const devices = await this.deviceRepository.findAll();
        const rooms = await this.roomRepository.findAll();
        
        const matchingDevices = devices.filter(d => this.normalizePrompt(d.name) === this.normalizePrompt(target));
        const matchingRooms = rooms.filter(r => this.normalizePrompt(r.name) === this.normalizePrompt(target));
        
        const totalMatches = matchingDevices.length + matchingRooms.length;
        
        // Safety: check alias does not match existing device name
        const nameCollision = devices.some(d => this.normalizePrompt(d.name) === this.normalizePrompt(alias));
        // Safety: check alias does not already exist
        const existingAlias = await this.memoryService.getAlias(userId, alias);

        if (totalMatches === 1 && !nameCollision && !existingAlias) {
          const targetEntity = matchingDevices.length > 0 ? matchingDevices[0] : matchingRooms[0];
          const type = matchingDevices.length > 0 ? 'device' : 'room';
          
          await this.memoryService.setAlias(userId, alias, targetEntity.id);
          
          console.info(`[ASSISTANT_USER_ALIAS_CREATED] {"userId":"${userId}","alias":"${alias}","targetId":"${targetEntity.id}","targetName":"${targetEntity.name}","type":"${type}"}`);
          
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
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] {"userId":"${userId}","alias":"${alias}","target":"${target}","reason":"ambiguous"}`);
            message = isEn
              ? `I found multiple items named "${target}". Please be more specific.`
              : `Encontré varios elementos llamados "${target}". Por favor, sé más específico.`;
          } else {
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] {"userId":"${userId}","alias":"${alias}","target":"${target}","reason":"not_found"}`);
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
      const devices = await this.deviceRepository.findAll();
      allDevices = devices.filter(d => ids.includes(d.id));
    } else {
      allDevices = await this.deviceRepository.findAll();
    }

    if (!allDevices) {
      return {
        type: 'answer',
        message: language === 'en' ? 'No devices found.' : 'No se encontraron dispositivos.'
      };
    }

    // Resolve room map from repository
    // Priority: Rooms belonging to the homes of the devices being queried
    const roomMap = await this.buildRoomNameMap(allDevices);
    
    // Fallback: If no rooms found via device homes, try global room list
    if (roomMap.size === 0) {
      const allRooms = await this.roomRepository.findAll();
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
    const rooms = await this.roomRepository.findAll();
    
    // We need to identify if there's a potential room mention in the prompt.
    // Since we don't have a static list, we'll look for room names or aliases in the prompt.
    const resolution = this.resolveRoomAlias(normalized, rooms, allDevices, userId, userAliases);
    
    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      targetRoomId = resolution.rooms[0].id;
      targetRoomName = resolution.rooms[0].name;
    } else if (resolution.status === 'ambiguous') {
      // For state queries, if ambiguous, we can either return an answer or just treat as global.
      // But the requirement says: "If a phrase looks like it references a room but no room resolves, return: No encontré esa estancia."
      // Ambiguous is a form of "not resolved yet".
      return {
        type: 'answer',
        message: language === 'en' 
          ? `I found several rooms that could match. Please be more specific.` 
          : `Encontré varias estancias que podrían coincidir. Por favor, sé más específico.`
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
           message: language === 'en' ? "I couldn't find that room." : "No encontré esa estancia."
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
          const rooms = await this.roomRepository.findAll();
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
            message: language === 'en' ? 'In which room?' : '¿En qué estancia?',
            clarification: {
              question: language === 'en' ? 'Which room?' : '¿En qué estancia?',
              options,
              pendingAction: { originalPrompt: normalized }
            }
          };
        }
      }

      if (isLightsOnly) {
        filteredDevices = filteredDevices.filter(d => this.isLightEntity(d));
      }
    }

    // If no devices match the query at all
    if (filteredDevices.length === 0) {
      if (targetRoomName) {
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find any ${isLightsOnly ? 'lights' : 'devices'} in ${targetRoomName}.`
            : `No encontré ${isLightsOnly ? 'luces' : 'dispositivos'} en ${targetRoomName}.`
        };
      }
      return {
        type: 'answer',
        message: language === 'en'
          ? "I could not find any devices matching that query."
          : "No encontré dispositivos que coincidan con esa consulta."
      };
    }

    // Split into explicit On/Off
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
      ? (language === 'en' ? `${namePrefix}status in ${targetRoomName}:\n\n` : `${namePrefix}estado en ${targetRoomName}:\n\n`)
      : (language === 'en' ? `${namePrefix}home status:\n\n` : `${namePrefix}estado de la casa:\n\n`);

    message = areaPrefix;

    if (isCompound || hasNoExplicitState) {
      // If devices exist but we have NO known states for any of them, fallback gracefully
      if (onDevices.length === 0 && offDevices.length === 0) {
        return {
          type: 'answer',
          message: language === 'en'
            ? "I could not find any devices matching that query."
            : "No encontré dispositivos que coincidan con esa consulta."
        };
      }

      message = areaPrefix;

      // On section
      message += language === 'en' ? "On:\n" : "Encendidas:\n";
      if (onDevices.length > 0) {
        for (const d of onDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
        }
      } else {
        message += language === 'en' ? "• None" : "• Ninguna";
      }

      message += "\n";

      // Off section
      message += language === 'en' ? "Off:\n" : "Apagadas:\n";
      if (offDevices.length > 0) {
        for (const d of offDevices) {
          const rName = this.resolveRoomName(d.roomId, roomMap, language);
          message += `• ${d.name}${rName ? ` (${rName})` : ''}\n`;
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

  private async handleDetailFollowUp(memory: AssistantMemoryState, language: string): Promise<AssistantConversationResponse> {
    const isEn = language === 'en';
    const rememberedIds = (memory.entities || []).map(e => e.id);
    const devices = await this.deviceRepository.findAll();
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

  private levenshteinDistance(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private findFuzzyCandidateSuggestions(targetPhrase: string, devices: readonly Device[], language: string, command: DeviceCommandV1, originalPrompt: string): AssistantConversationResponse | null {
    if (!targetPhrase || targetPhrase.trim().length < 3) return null;

    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
    const targetNorm = normalize(targetPhrase);

    let bestMatch: Device | null = null;
    let bestScore = 0; // 0 to 1, where 1 is exact match

    for (const d of devices) {
      if (!this.isDeviceAvailable(d)) continue;
      // Note: we don't strictly filter by supportsCommand here because maybe they asked "prende la tv" but it's a sensor?
      // Actually we should only suggest controllable devices if it's a command.
      if (!this.isControllableDevice(d, command)) continue;

      const nameNorm = normalize(d.name);
      
      // Calculate similarity
      const distance = this.levenshteinDistance(targetNorm, nameNorm);
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
        message: language === 'en'
          ? `I didn't find a device called '${targetPhrase}'. Did you mean '${bestMatch.name}'?`
          : `No encontré un dispositivo llamado '${targetPhrase}'. ¿Quisiste decir '${bestMatch.name}'?`,
        clarification: {
          question: language === 'en' ? `Did you mean '${bestMatch.name}'?` : `¿Quisiste decir '${bestMatch.name}'?`,
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
      message: language === 'en' 
        ? `I couldn't find a device called '${targetPhrase}'.` 
        : `No encontré un dispositivo llamado '${targetPhrase}'.`
    };
  }

  private async findMatchingDevices(prompt: string, userId: string = 'system'): Promise<Device[]> {
    const normalized = this.normalizePrompt(prompt);
    let devices = await this.deviceRepository.findAll();
    
    // Filter out non-controllable/deprecated devices
    devices = devices.filter(d => this.isDeviceAvailable(d));
    
    // 1. Check for Exact Match first (highest priority)
    const exactMatch = devices.find(d => this.normalizePrompt(d.name) === normalized);
    if (exactMatch) return [exactMatch];

    // 2. Phrase Matching (Requirement: normalized prompt contains device name)
    // "prende luz escritorio" -> matchea "luz escritorio" pero no "luz cocina"
    const phraseMatches = devices.filter(d => {
      const deviceName = this.normalizePrompt(d.name);
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
      const name = this.normalizePrompt(d.name);
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
    const devices = await this.deviceRepository.findAll();
    
    // Buscar dispositivo en el prompt
    const matches = devices.filter(d => normalized.includes(this.normalizePrompt(d.name)));
    
    if (matches.length === 0) {
      // Intentar buscar habitación
      const rooms = (await this.roomRepository.findAll()) || [];
      const roomMatch = rooms.find(r => normalized.includes(this.normalizePrompt(r.name)));
      
      if (roomMatch) {
        const roomDevices = devices.filter(d => d.roomId === roomMatch.id && this.isControllableDevice(d, 'turn_on'));
        if (roomDevices.length === 0) {
          return {
            type: 'answer',
            message: language === 'en' ? `I don't see controllable devices in ${roomMatch.name}.` : `No veo dispositivos controlables en ${roomMatch.name}.`
          };
        }
        
        const onDevices = roomDevices.filter(d => d.lastKnownState?.state === 'on');
        const total = roomDevices.length;
        
        if (onDevices.length === 0) {
          return {
            type: 'answer',
            message: language === 'en' ? `Everything is off in ${roomMatch.name}.` : `Todo está apagado en ${roomMatch.name}.`
          };
        } else if (onDevices.length === total) {
          return {
            type: 'answer',
            message: language === 'en' ? `Everything is on in ${roomMatch.name}.` : `Todo está encendido en ${roomMatch.name}.`
          };
        } else {
          return {
            type: 'answer',
            message: language === 'en' 
              ? `There are ${onDevices.length} out of ${total} devices on in ${roomMatch.name}.` 
              : `Hay ${onDevices.length} de ${total} dispositivos encendidos en ${roomMatch.name}.`
          };
        }
      }

      return {
        type: 'answer',
        message: language === 'en' ? "I couldn't find the device you're asking about." : "No pude encontrar el dispositivo por el que preguntas."
      };
    }

    if (matches.length > 1) {
      const options = matches.map(d => ({ id: d.id, label: d.name, kind: 'device' as const }));
      return {
        type: 'clarification',
        message: language === 'en' ? "I found several devices with that name. Which one do you mean?" : "Encontré varios dispositivos con ese nombre. ¿A cuál te refieres?",
        clarification: { question: language === 'en' ? "Which one?" : "¿Cuál?", options, pendingAction: { originalPrompt: normalized } }
      };
    }

    const device = matches[0];
    const state = device.lastKnownState?.state;
    const isAskingOn = normalized.includes('encendid') || normalized.includes('prendid') || normalized.includes('on');
    const isAskingOff = normalized.includes('apagad') || normalized.includes('off');

    const isOn = state === 'on' || (typeof state === 'number' && state > 0);
    
    let answer = '';
    if (isAskingOn) {
      answer = isOn 
        ? (language === 'en' ? `Yes, ${device.name} is on.` : `Sí, ${device.name} está encendido.`)
        : (language === 'en' ? `No, ${device.name} is off.` : `No, ${device.name} está apagado.`);
    } else if (isAskingOff) {
      answer = !isOn
        ? (language === 'en' ? `Yes, ${device.name} is off.` : `Sí, ${device.name} está apagado.`)
        : (language === 'en' ? `No, ${device.name} is on.` : `No, ${device.name} está encendido.`);
    } else {
      answer = isOn
        ? (language === 'en' ? `${device.name} is on.` : `${device.name} está encendido.`)
        : (language === 'en' ? `${device.name} is off.` : `${device.name} está apagado.`);
    }

    return { type: 'answer', message: answer };
  }

  // --- LISTING ---

  private isListScenesIntent(normalized: string): boolean {
    return normalized.includes('escenas') && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list') || normalized.includes('show'));
  }

  private async handleListScenes(language: string): Promise<AssistantConversationResponse> {
    const scenes = await this.sceneRepository.findAll();
    if (scenes.length === 0) {
      return { type: 'answer', message: language === 'en' ? "You don't have any scenes created yet." : "Aún no tienes escenas creadas." };
    }
    const list = scenes.map(s => `• ${s.name}`).join('\n');
    return {
      type: 'answer',
      message: (language === 'en' ? "These are your scenes:\n" : "Estas son tus escenas:\n") + list
    };
  }

  private isListAutomationsIntent(normalized: string): boolean {
    return (normalized.includes('automatizaciones') || normalized.includes('rutinas') || normalized.includes('automations')) && (normalized.includes('que') || normalized.includes('lista') || normalized.includes('muestra') || normalized.includes('what') || normalized.includes('list'));
  }

  private async handleListAutomations(language: string): Promise<AssistantConversationResponse> {
    const automations = await this.automationRepository.findAll();
    if (automations.length === 0) {
      return { type: 'answer', message: language === 'en' ? "You don't have any automations yet." : "Aún no tienes automatizaciones." };
    }
    const list = automations.map(a => `• ${a.name} — ${a.enabled ? (language === 'en' ? 'active' : 'activa') : (language === 'en' ? 'inactive' : 'inactiva')}`).join('\n');
    return {
      type: 'answer',
      message: (language === 'en' ? "These are your automations:\n" : "Estas son tus automatizaciones:\n") + list
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
      const scenes = await this.sceneRepository.findAll();
      const scene = scenes.find(s => this.normalizePrompt(s.name) === this.normalizePrompt(oldName));
      
      if (!scene) return { type: 'answer', message: language === 'en' ? `Scene "${oldName}" not found.` : `No encontré la escena "${oldName}".` };
      
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
        message: language === 'en' 
          ? `I'm going to rename the scene "${scene.name}" to "${newName}". Confirm?` 
          : `Voy a renombrar la escena "${scene.name}" a "${newName}". ¿Confirmo?`,
        clarification: { 
          question: language === 'en' ? "Confirm?" : "¿Confirmo?", 
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes' : 'Sí', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No' : 'No', kind: 'scene' }
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
      
      const automations = await this.automationRepository.findAll();
      const auto = automations.find(a => this.normalizePrompt(a.name) === this.normalizePrompt(autoName));
      
      if (!auto) return { type: 'answer', message: language === 'en' ? `Automation "${autoName}" not found.` : `No encontré la automatización "${autoName}".` };
      
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
        message: language === 'en'
          ? `I'm going to ${enabled ? 'enable' : 'disable'} the automation "${auto.name}". Confirm?`
          : `Voy a ${enabled ? 'activar' : 'desactivar'} la automatización "${auto.name}". ¿Confirmo?`,
        clarification: { 
          question: language === 'en' ? "Confirm?" : "¿Confirmo?", 
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes' : 'Sí', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No' : 'No', kind: 'scene' }
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
      
      const scenes = await this.sceneRepository.findAll();
      const scene = scenes.find(s => this.normalizePrompt(s.name) === this.normalizePrompt(sceneName));
      if (!scene) return { type: 'answer', message: language === 'en' ? `Scene "${sceneName}" not found.` : `No encontré la escena "${sceneName}".` };
      
      const devices = await this.deviceRepository.findAll();
      const device = devices.find(d => this.normalizePrompt(d.name) === this.normalizePrompt(deviceName));
      if (!device) return { type: 'answer', message: language === 'en' ? `Device "${deviceName}" not found.` : `No encontré el dispositivo "${deviceName}".` };

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
        message: language === 'en'
          ? `I'm going to add "${device.name}" (off) to the scene "${scene.name}". Confirm?`
          : `Voy a agregar "${device.name}" (apagado) a la escena "${scene.name}". ¿Confirmo?`,
        clarification: { 
          question: language === 'en' ? "Confirm?" : "¿Confirmo?", 
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes' : 'Sí', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No' : 'No', kind: 'scene' }
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
      
      const scenes = await this.sceneRepository.findAll();
      const scene = scenes.find(s => this.normalizePrompt(s.name) === this.normalizePrompt(sceneName));
      if (!scene) return { type: 'answer', message: language === 'en' ? `Scene "${sceneName}" not found.` : `No encontré la escena "${sceneName}".` };
      
      const devices = await this.deviceRepository.findAll();
      const device = devices.find(d => this.normalizePrompt(d.name) === this.normalizePrompt(deviceName));
      const action = scene.actions.find(a => a.deviceId === device?.id || a.deviceId === deviceName);
      
      if (!action) return { type: 'answer', message: language === 'en' ? `Device "${deviceName}" is not in the scene.` : `El dispositivo "${deviceName}" no está en la escena.` };

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
        message: language === 'en'
          ? `I'm going to remove "${device?.name || deviceName}" from the scene "${scene.name}". Confirm?`
          : `Voy a quitar "${device?.name || deviceName}" de la escena "${scene.name}". ¿Confirmo?`,
        clarification: { 
          question: language === 'en' ? "Confirm?" : "¿Confirmo?", 
          options: [
            { id: 'confirm', label: language === 'en' ? 'Yes' : 'Sí', kind: 'scene' },
            { id: 'cancel', label: language === 'en' ? 'No' : 'No', kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    return { type: 'answer', message: language === 'en' ? "I'm not sure how to manage that." : "No estoy seguro de cómo gestionar eso." };
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
          return { type: 'answer', message: language === 'en' ? `Ready, scene renamed to "${scene.name}".` : `Listo, renombré la escena a "${scene.name}".` };
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
          return { type: 'answer', message: language === 'en' ? `Ready, automation "${auto.name}" ${enabled ? 'enabled' : 'disabled'}.` : `Listo, ${enabled ? 'activé' : 'desactivé'} la automatización "${auto.name}".` };
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
            return { type: 'answer', message: language === 'en' ? `Ready, updated scene "${scene.name}".` : `Listo, actualicé la escena "${scene.name}".` };
          }
        } else if (mode === 'remove') {
          if (!deviceId) throw new Error('INVALID_PAYLOAD: deviceId is required for remove mode');
          const scene = await this.sceneRepository.findSceneById(targetId);
          if (scene) {
            scene.actions = scene.actions.filter(a => a.deviceId !== deviceId);
            scene.updatedAt = new Date().toISOString();
            await this.sceneRepository.saveScene(scene);
            await this.clearPendingAction(userId);
            return { type: 'answer', message: language === 'en' ? `Ready, updated scene "${scene.name}".` : `Listo, actualicé la escena "${scene.name}".` };
          }
        }
      }

      return { type: 'error', message: language === 'en' ? "Failed to execute management action." : "No se pudo ejecutar la acción de gestión." };
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

  private async executeSingleCommand(deviceId: string, command: DeviceCommandV1, prompt: string, correlationId: string): Promise<SceneExecutionResult> {
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
        command: { name: command, params: {} }
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
        
        const result = await this.executeSingleCommand(fail.deviceId, commandName, request.prompt, correlationId);
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

  private returnWithShadow(prompt: string, userId: string, language: string, response: AssistantConversationResponse): AssistantConversationResponse {
    // Required: Any successful deterministic execution must return directly and bypass Planner V2 Shadow
    if (response.type === 'execution' || response.type === 'clarification') {
      return response;
    }
    
    if (response.type === 'answer' && response.execution) {
      return response;
    }

    if (this.shadowService) {
      this.shadowService.runShadow(prompt, userId, language, response).catch(() => {});
    }
    return response;
  }

  private extractTargetPhrase(prompt: string): string {
    const norm = this.normalizePrompt(prompt);
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
    // Optional preposition cluster (en|el|del|de|la|las)
    // Group 3: Room name (mandatory, at least one non-empty token after bulk keyword)
    const esRegex = /^(enciende|prende|apaga|activa|desactiva)\s+(todo|todas\s+las\s+luces|todas\s+las|todas|todo\s+el|todo\s+en|las\s+luces|luces)\s+(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)$/i;
    const esMatch = normalized.match(esRegex);
    if (esMatch) {
      const verb = esMatch[1].toLowerCase();
      const command = (verb === 'enciende' || verb === 'prende' || verb === 'activa') ? 'turn_on' : 'turn_off';
      const bulkKeyword = esMatch[2].toLowerCase().trim();
      const roomName = esMatch[3].trim();
      // Guard: if the captured room name is itself a bulk-only word, no room was actually given
      if (esBulkOnlyWords.includes(roomName)) return null;
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

  private async handleRoomSingularLightFastPath(
    userId: string,
    command: 'turn_on' | 'turn_off',
    roomName: string,
    language: string,
    originalPrompt: string,
    userAliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);
    
    const resolution = this.resolveRoomAlias(roomName, Array.from(rooms), Array.from(devices), userId, userAliases);
    if (resolution.status === 'resolved' && resolution.rooms.length > 0) {
      return await this.handleRoomSelectionForLight(resolution.rooms[0].id, command, userId, language, originalPrompt, `singular-${Date.now()}`);
    }
    
    return null;
  }

  private resolveRoomAlias(roomName: string, rooms: ReadonlyArray<Room>, devices: ReadonlyArray<Device>, userId: string, userAliases: Record<string, string>): RoomAliasResolution {
    const normPromptRoom = this.normalizePrompt(roomName);
    const roomEntries = rooms.map(r => ({ room: r, norm: this.normalizePrompt(r.name) }));

    // Priority 1: Exact Match (normalized equality)
    const exactMatches = roomEntries.filter(e => e.norm === normPromptRoom);
    if (exactMatches.length === 1) return { status: 'resolved', rooms: [exactMatches[0].room] };
    if (exactMatches.length > 1) {
      const candidates = exactMatches.map(e => e.room.name);
      console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ input: roomName, type: 'exact', candidates })}`);
      return { status: 'ambiguous', rooms: [], candidates }; 
    }

    // Priority 2: Fuzzy Match (includes both ways)
    const fuzzyMatches = roomEntries.filter(e => e.norm.includes(normPromptRoom) || normPromptRoom.includes(e.norm));
    if (fuzzyMatches.length === 1) return { status: 'resolved', rooms: [fuzzyMatches[0].room] };
    if (fuzzyMatches.length > 1) {
      const candidates = fuzzyMatches.map(e => e.room.name);
      console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ input: roomName, type: 'fuzzy', candidates })}`);
      return { status: 'ambiguous', rooms: [], candidates };
    }

    // Priority 3: User-defined alias (NEW)
    const normUserAliases = Object.entries(userAliases).map(([alias, targetId]) => ({
      norm: this.normalizePrompt(alias),
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
          console.info(`[ASSISTANT_USER_ALIAS_RESOLVED] ${JSON.stringify({ alias: bestMatches[0].norm, input: roomName, resolved: room.name })}`);
          return { status: 'resolved', rooms: [room] };
        } else {
          // If target is not a room, check if it's a device. If it's a device, we ignore it here (room context)
          // but if it's neither, we log invalid.
          const isDevice = devices.some(d => d.id === targetId);
          if (!isDevice) {
            console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, alias: roomName, targetId, reason: 'entity_not_found' })}`);
          }
        }
      } else {
        const candidateNames = bestMatches.map(m => {
          const r = rooms.find(room => room.id === m.targetId);
          return r?.name || m.targetId;
        });
        console.info(`[ASSISTANT_ROOM_ALIAS_AMBIGUOUS] ${JSON.stringify({ input: roomName, type: 'user_alias', candidates: candidateNames })}`);
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
    userAliases: Record<string, string>,
    interactionMode: 'chat' | 'voice' = 'chat'
  ): Promise<AssistantConversationResponse> {
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);
    
    console.info(`[ASSISTANT_USER_ALIAS_LOOKUP] ${JSON.stringify({ userId, aliases: userAliases, roomName })}`);
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
      return this.isControllableForBulk(d, command, bulkType);
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

    if (interactionMode === 'voice') {
      return this.handleBulkActionAccept(userId, language, {
        deviceIds,
        command,
        bulkType,
        originalPrompt: `Voice bulk room action for ${displayRoomName}`,
      });
    }
    
    console.info(`[ASSISTANT_BULK_CONFIRMATION_REQUIRED] ${JSON.stringify({
      source: "room_bulk_fast_path",
      room: displayRoomName,
      count: matchingDevices.length,
      command,
      bulkType
    })}`);

    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds,
        command,
        bulkType,
        timestamp: new Date().toISOString(),
        originalPrompt: `Bulk room action for ${displayRoomName}`
      }
    });

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
    // Exclusion syntax must go through multi-command parser, not bulk fast-path
    const exclusionWords = ['menos', 'excepto', 'salvo', 'except', 'minus'];
    if (exclusionWords.some(w => normalized.includes(w))) return null;

    const lightsTriggers = [
      'enciende todas las luces',
      'prende todas las luces',
      'apaga todas las luces',
      'turn on all lights',
      'turn off all lights',
    ];
    const allTriggers = [
      'apaga todo',
      'prende todo',
      'enciende todo',
      'turn off everything',
      'turn on everything',
      'turn everything off',
      'turn everything on'
    ];

    const isOff = normalized.includes('apaga') || normalized.includes('turn off') || normalized.includes('off');
    const command = isOff ? 'turn_off' : 'turn_on';

    if (lightsTriggers.some(t => normalized.includes(t))) {
      return { command, bulkType: 'lights' };
    }
    if (allTriggers.some(t => normalized.includes(t))) {
      return { command, bulkType: 'all' };
    }

    return null;
  }

  private async handleBulkFastPath(normalized: string, bulkType: 'all' | 'lights', command: 'turn_on' | 'turn_off', language: string, userId: string, interactionMode: 'chat' | 'voice' = 'chat'): Promise<AssistantConversationResponse | null> {
    const allDevices = await this.deviceRepository.findAll();
    
    const targetDevices = allDevices.filter(d => {
      return this.isControllableForBulk(d, command, bulkType);
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
    if (interactionMode === 'voice') {
      return this.handleBulkActionAccept(userId, language, {
        deviceIds,
        command,
        bulkType,
        originalPrompt: normalized,
      });
    }
    console.info(`[ASSISTANT_BULK_CONFIRMATION_REQUIRED] ${JSON.stringify({ 
      source: 'bulk_fast_path', 
      count: targetDevices.length, 
      command,
      bulkType
    })}`);

    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds,
        command,
        bulkType,
        timestamp: new Date().toISOString(),
        originalPrompt: normalized
      }
    });

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

    const normPrompt = this.normalizePrompt(activePrompt);
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

    const devices = await this.deviceRepository.findAll();
    const normTarget = this.normalizePrompt(targetPhrase);

    // Priority 1: Exact real device name wins over alias
    const exactDevice = devices.find(d => this.normalizePrompt(d.name) === normTarget);
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

    const match = this.findBestAliasMatch(targetPhrase, deviceAliases);

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
      console.warn(`[ASSISTANT_DEVICE_ALIAS_INVALID] ${JSON.stringify({ alias: match.alias, targetId: match.targetId })}`);
      return null;
    }

    console.info(`[ASSISTANT_DEVICE_ALIAS_RESOLVED] ${JSON.stringify({ alias: match.alias, targetId: targetDevice.id, command })}`);
    const execResult = await this.executeSingleCommand(targetDevice.id, command, activePrompt, `alias-fastpath-${Date.now()}`);
    
    if (execResult.status === 'success') {
      await this.clearPendingAction(userId);
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'command',
        entities: [{ id: targetDevice.id, name: targetDevice.name, type: targetDevice.type, roomId: targetDevice.roomId }],
        timestamp: new Date().toISOString()
      });
      console.info(`[PLANNER_V2_MEMORY_SAVED] ${JSON.stringify({ source: 'device_alias', deviceId: targetDevice.id, deviceName: targetDevice.name, alias: match.alias })}`);

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
    const devices = await this.deviceRepository.findAll();
    const result = this.fastPathResolver.resolve(activePrompt, Array.from(devices));
    if (!result) return null;

    const device = devices.find((d) => d.id === result.deviceId);
    if (!device) return null;
    if (!this.isControllableDevice(device, result.command)) return null;

    const execResult = await this.executeSingleCommand(result.deviceId, result.command, activePrompt, `fastpath-${Date.now()}`);
    
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
      console.info(`[ASSISTANT_CONFIRMATION_REQUIRED] prompt="${activePrompt}" count=${v2Result.resolvedIds?.length}`);
      
      await this.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'confirmation',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingBulkAction: {
          type: 'bulk_action',
          deviceIds: v2Result.resolvedIds || [],
          command: v2Result.command,
          timestamp: new Date().toISOString(),
          originalPrompt: activePrompt
        }
      });

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
    
    const execResult = await this.executeSingleCommand(v2Result.deviceId, v2Result.command as DeviceCommandV1, activePrompt, `hybrid-${Date.now()}`);
    
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
        : (language === 'en' ? "Execution failed." : "La ejecución falló."),
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

    const normalized = this.normalizePrompt(prompt);
    const vagueMatch = this.isVagueLightCommand(normalized, language);
    if (!vagueMatch) return null;

    // 2. Explicit target guard (MANDATORY)
    const [rooms, devices] = await Promise.all([
      this.roomRepository.findAll(),
      this.deviceRepository.findAll()
    ]);

    // Ensure prompt does not contain explicit room names
    for (const room of rooms) {
      if (normalized.includes(this.normalizePrompt(room.name))) return null;
    }
    // Ensure prompt does not contain explicit device names
    for (const device of devices) {
      if (normalized.includes(this.normalizePrompt(device.name))) return null;
    }
    // Ensure prompt does not contain user-defined aliases
    for (const alias of Object.keys(aliases)) {
      if (normalized.includes(this.normalizePrompt(alias))) return null;
    }

    // 3. Contextual Resolution
    const targetRoom = rooms.find(r => r.id === sourceRoomId);
    if (!targetRoom) return null;

    const roomDevices = devices.filter(d => d.roomId === sourceRoomId);
    const lights = roomDevices.filter(d => this.isLightEntity(d) && this.isDeviceAvailable(d));

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
          question: language === 'en' ? "Which one?" : "¿Cuál?",
          options: clarificationOptions,
          pendingAction: {
            command: vagueMatch.command,
            originalPrompt: prompt
          }
        }
      };
    }

    // 4. Execution
    const execResult = await this.executeSingleCommand(selectedLight.id, vagueMatch.command, prompt, `context-${Date.now()}`);
    
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
