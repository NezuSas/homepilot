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
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
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

export interface AssistantConversationResponse {
  type: "answer" | "execution" | "clarification" | "error";
  message: string;
  execution?: SceneExecutionResult;
  clarification?: {
    question: string;
    options: Array<{
      id: string;
      label: string;
      kind: "device" | "scene";
    }>;
    pendingAction?: {
      command?: DeviceCommandV1;
      targetId?: string;
      originalPrompt: string;
    };
  };
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
    private readonly executionRecordRepository: ExecutionRecordRepository
  ) {}

  public async converse(request: AssistantConverseRequest, language: string = 'es'): Promise<AssistantConversationResponse> {
    const t0 = Date.now();
    const prompt = request.prompt.trim();
    const userId = request.userId || 'system';
    const userName = request.userName?.trim() || null;
    const namePrefix = userName ? `${userName}, ` : '';
    const normalized = this.normalizePrompt(prompt);

    // V2: Load Contextual Memory & Aliases FIRST
    const t_mem = Date.now();
    const [memory, aliases] = await Promise.all([
      this.memoryService.getShortTermMemory(userId),
      this.memoryService.getAliases(userId)
    ]);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AssistantConversation] Memory load took ${Date.now() - t_mem}ms`);
    }

    // --- TOP PRIORITY: MANAGEMENT CONFIRMATION ---
    if (memory?.pendingManagementAction) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);

      if (isAffirmative) {
        return await this.executeManagementAction(memory.pendingManagementAction, userId, language);
      } else if (isNegative) {
        await this.clearPendingAction(userId);
        return {
          type: 'answer',
          message: language === 'en' ? "Action cancelled." : "Acción cancelada."
        };
      }
    }

    // --- PRE-INTENT: PRONOUN RESOLUTION ("apágala", etc.) ---
    const pronounIntent = await this.resolvePronounIntent(normalized, memory, language);
    if (pronounIntent) {
      if ('type' in pronounIntent && pronounIntent.type === 'clarificationRequired') {
        return {
          type: 'clarification',
          message: language === 'en' ? "I found several options for that. Which one do you mean?" : "Encontré varias opciones para eso. ¿A cuál te refieres?",
          clarification: {
            question: language === 'en' ? "Which one?" : "¿Cuál?",
            options: pronounIntent.options.map(opt => ({ ...opt, kind: 'device' }))
          }
        };
      }
      return await this.executeIntent(pronounIntent as Intent, request, language, userId, userName, prompt);
    }

    // --- SECOND PRIORITY: DRAFT CONFIRMATION ---
    // Handle both UI button clicks (selectedOptionId='confirm'/'cancel') and natural language ("sí", "no")
    if (memory?.pendingDraft) {
      const isAffirmative = request.selectedOptionId === 'confirm' || this.isPositiveConfirmation(normalized);
      const isNegative = request.selectedOptionId === 'cancel' || this.isNegativeConfirmation(normalized);

      if (isAffirmative) {
        try {
          await this.draftService.activateDraft(memory.pendingDraft.id, userId);
          await this.clearPendingAction(userId);
          return {
            type: 'answer',
            message: language === 'en' ? "Ready. Scene activated successfully." : "Listo. Escena activada correctamente."
          };
        } catch (err: unknown) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[AssistantConversation] Error activating draft:', err);
          }
          return {
            type: 'error',
            message: language === 'en' ? "Failed to activate draft." : "No se pudo activar la escena."
          };
        }
      } else if (isNegative) {
        await this.clearPendingAction(userId);
        return {
          type: 'answer',
          message: language === 'en' ? "Understood, I didn't activate the scene." : "Entendido, no activé la escena."
        };
      }
    }

    // A) Selected Option Flow
    if (request.selectedOptionId) {
      if (memory?.pendingIntent && (request.selectedOptionId === 'confirm' || request.selectedOptionId === 'cancel')) {
        if (request.selectedOptionId === 'confirm') {
          request.confirmed = true;
          const intent = memory.pendingIntent;
          return await this.executeIntent(intent, request, language, userId, userName, memory.originalPrompt || prompt);
        } else {
          await this.clearPendingAction(userId);
          return {
            type: 'answer',
            message: language === 'en' ? "Action cancelled." : "Acción cancelada."
          };
        }
      }

      const result = await this.handleSelection(request, language);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] converse() selection path: ${Date.now() - t0}ms`);
      }
      return result;
    }

    // V2: Follow-up Resolution
    let activePrompt = prompt;
    let followUp: ResolvedFollowUp = { resolvedPrompt: prompt, handled: false, referencesMemory: false };

    if (!request.selectedOptionId) {
      const t_followup = Date.now();
      
      // V2: Handle simple "yes/no" or "confirm/cancel" if there is a pending action
      if (this.isConfirmation(normalized)) {
        // A1: Check Pending Intent
        if (memory?.pendingIntent) {
          const now = Date.now();
          const pendingTime = new Date(memory.pendingIntent.timestamp).getTime();
          const isExpired = now - pendingTime > 300000; // 5 minutes

          if (!isExpired) {
            if (this.isPositiveConfirmation(normalized)) {
              request.confirmed = true;
              const intent = memory.pendingIntent;
              return await this.executeIntent(intent, request, language, userId, userName, memory.originalPrompt || prompt);
            } else if (this.isNegativeConfirmation(normalized)) {
              await this.clearPendingAction(userId);
              return {
                type: 'answer',
                message: language === 'en' ? "Action cancelled." : "Acción cancelada."
              };
            }
          } else {
            // Auto-clear if expired
            await this.clearPendingAction(userId);
          }
        }

        // If user says "yes" but nothing is pending
        if (this.isPositiveConfirmation(normalized)) {
          return {
            type: 'answer',
            message: language === 'en' ? "Confirm what? I don't have any pending actions." : "¿Confirmar qué? No tengo ninguna acción pendiente."
          };
        }
      }

      // V2: Handle clarification selection via natural language (e.g. "la primera", "la de la cocina")
      if (memory?.clarificationOptions && memory.clarificationOptions.length > 0) {
        const selectedId = this.resolveSelectionFromMemory(normalized, memory.clarificationOptions, language);
        if (selectedId) {
          const selectedOption = memory.clarificationOptions.find(opt => opt.id === selectedId);
          
          // Reconstruct pending action from memory
          const command = memory.pendingIntent?.type === 'command' 
            ? (memory.pendingIntent.command as DeviceCommandV1)
            : this.inferCommandFromPrompt(memory.originalPrompt || prompt);

          request.selectedOptionId = selectedId;
          request.pendingAction = {
            command,
            targetId: selectedId,
            originalPrompt: memory.originalPrompt || prompt
          };

          if (!command) {
            // Fallback: Selected but no command inferred
            await this.memoryService.saveShortTermMemory(userId, {
              ...memory,
              entities: [{ 
                id: selectedId, 
                name: selectedOption?.label || 'Selected', 
                type: 'device',
                roomId: null 
              }],
              timestamp: new Date().toISOString()
            });

            return {
              type: 'answer',
              message: language === 'en'
                ? `I've selected ${selectedOption?.label}. What would you like to do with it?`
                : `Seleccioné ${selectedOption?.label}. ¿Qué quieres hacer con este dispositivo?`
            };
          }

          return await this.handleSelection(request, language);
        }
      }

      followUp = this.followUpResolver.resolve(
        prompt,
        memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() },
        language,
        aliases
      );
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] FollowUpResolver took ${Date.now() - t_followup}ms`);
      }
      if (followUp.handled && followUp.response) {
        return { type: 'answer', message: followUp.response };
      }
      activePrompt = followUp.resolvedPrompt;
    }

    // V2: Follow-up Resolution
    
    // A2) Semantic Equivalence
    if (this.isEquivalenceQuery(normalized)) {
      return this.handleEquivalenceQuery(language);
    }

    // B) Greetings
    if (this.isGreeting(normalized)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? `Hi${userName ? ', ' + userName : ''}. I’m ready to help with your home. You can ask what is on or ask me to control a light, scene, or device.`
          : `Hola${userName ? ', ' + userName : ''}, estoy listo para ayudarte con tu casa. Puedes preguntarme qué está encendido o pedirme que controle alguna luz, escena o dispositivo.`
      };
    }

    // B2) Wellness queries — deterministic, never routed to LLM
    if (this.isWellnessQuery(normalized)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? `I'm operating normally${userName ? ', ' + userName : ''}. The system is stable. Would you like me to check something in your home?`
          : `Estoy funcionando correctamente${userName ? ', ' + userName : ''}. Todo el sistema está estable. ¿Quieres que revise algo en tu casa?`
      };
    }

    // Identity / Name queries
    if (normalized === 'como te llamas' || 
        normalized === 'quien eres' || 
        normalized === 'quién eres' ||
        this.isNameQuery(normalized)) {
      return {
        type: 'answer',
        message: language === 'en' 
          ? "My name is HomePilot. I’m your local home assistant, designed to help you check, control, and understand your devices safely." 
          : "Me llamo HomePilot. Soy el asistente local de tu casa, diseñado para ayudarte a consultar, controlar y entender tus dispositivos de forma segura."
      };
    }

    // Creator queries
    const creatorKeywordsES = [
      'quien te creo', 'quién te creó', 
      'quien te hizo', 'quién te hizo', 
      'quien te desarrollo', 'quién te desarrolló',
      'quien creo homepilot', 'quién creó homepilot'
    ];
    const creatorKeywordsEN = [
      'who created you', 'who made you', 
      'who developed you', 'who created homepilot'
    ];

    if (creatorKeywordsES.includes(normalized) || (language === 'en' && creatorKeywordsEN.includes(normalized))) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "I was created by NEZU S.A.S., a company focused on automation, local control, and applied home intelligence. My purpose is to help you talk to your home in a safe, clear, and elegant way."
          : "Fui creado por NEZU S.A.S., una empresa enfocada en automatización, control local e inteligencia aplicada al hogar. Mi propósito es ayudarte a conversar con tu casa de forma segura, clara y elegante."
      };
    }

    // D) Presentation / Capabilities
    if (this.isPresentation(normalized)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "I can help you see what is on or off, control lights and devices, run scenes, ask for confirmation when an action is sensitive, and explain what happened if something fails."
          : "Puedo ayudarte a saber qué está encendido o apagado, controlar luces y dispositivos, ejecutar escenas, pedir confirmación cuando una acción sea delicada y explicarte si algo falla."
      };
    }

    // E) Help
    if (this.isHelpQuery(normalized)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "You can ask me things like: \"which lights are on?\", \"turn off the kitchen light\", or \"activate movie scene\". I'm here to help you manage your home locally."
          : "Puedes preguntarme cosas como: \"qué luces están encendidas?\", \"apaga la luz de la cocina\", o \"activa la escena cine\". Estoy aquí para ayudarte a gestionar tu casa de forma local."
      };
    }

    // F) Date/Time Queries
    if (this.isDateTimeQuery(normalized)) {
      return this.handleDateTimeQuery(normalized, language);
    }

    // F2) Room Queries (Deterministic)
    if (this.isRoomQuery(normalized)) {
      return await this.handleRoomQuery(language);
    }

    // G3) Draft Creation (Scenes/Automations) - High priority before state query
    if (this.isDraftCreation(normalized)) {
      return await this.handleDraftCreation(normalized, language, userId);
    }

    // G2) Alias Creation Commands
    if (this.isAliasCreation(normalized)) {
      return await this.handleAliasCreation(normalized, userId, language);
    }

    // G) Point State Queries (is X on/off?) - PRIORITY OVER GENERAL STATE
    if (this.isPointStateQuery(normalized)) {
      return await this.handlePointStateQuery(normalized, language, userId);
    }

    // H) State Queries
    if (this.isStateQuery(normalized)) {
      const t_state = Date.now();
      const result = await this.handleStateQuery(normalized, language, userName, userId, followUp.referencesMemory ? memory?.entities : undefined);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] StateQuery path took ${Date.now() - t_state}ms`);
      }
      return result;
    }

    // I) Management Intents (Rename, Toggle, Edit)
    if (this.isManagementIntent(normalized)) {
      return await this.handleManagementIntent(normalized, userId, language);
    }

    // J) Listing Intents (Scenes, Automations)
    if (this.isListScenesIntent(normalized)) {
      return await this.handleListScenes(language);
    }
    if (this.isListAutomationsIntent(normalized)) {
      return await this.handleListAutomations(language);
    }

    // Determine if we should attempt intent interpretation or just fallback to small talk directly
    if (!this.isLikelyHomeControlPrompt(normalized)) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[AssistantConversation] routing=smalltalk');
      }
      return this.smallTalkService.handle(activePrompt, language, userName, userId);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[AssistantConversation] routing=intent');
    }

    // C) Intent Interpretation
    const intentResult = await this.intentInterpreter.interpret(activePrompt);

    // Handle structured multi-command results
    if (intentResult && 'type' in intentResult) {
      if (intentResult.type === 'failure') {
        return { type: 'error', message: intentResult.message };
      }
      if (intentResult.type === 'clarificationRequired') {
        // Save pending query state so they can say "la primera"
        await this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'clarification',
          entities: [],
          timestamp: new Date().toISOString(),
          clarificationOptions: intentResult.options,
          originalPrompt: activePrompt
        });
        return {
          type: 'clarification',
          message: language === 'en' ? `I found multiple matches for "${intentResult.originalSegment}".` : `Encontré varias opciones para "${intentResult.originalSegment}".`,
          clarification: {
            question: language === 'en' ? "Which one do you mean?" : "¿A cuál te refieres?",
            options: intentResult.options.map(opt => ({ ...opt, kind: opt.kind as 'device' | 'scene' }))
          }
        };
      }
    }

    const intent: Intent = (intentResult && 'type' in intentResult && intentResult.type === 'success')
      ? intentResult.intent
      : (intentResult as Intent);

    // V2: If we interpreted a NEW intent, and there was a pending action, clear it to avoid context mixing
    if (intent && intent.type !== 'unknown' && (memory?.pendingIntent || memory?.pendingDraft)) {
      await this.clearPendingAction(userId);
    }

    if (!intent) {
      return await this.executeIntent({ type: 'unknown', prompt: activePrompt, reason: 'unknown' }, request, language, userId, userName, activePrompt);
    }

    return await this.executeIntent(intent, request, language, userId, userName, activePrompt);
  }

  private async executeIntent(
    intent: Intent, 
    request: AssistantConverseRequest, 
    language: string, 
    userId: string, 
    userName: string | null,
    prompt: string
  ): Promise<AssistantConversationResponse> {
    const t0 = Date.now();
    const namePrefix = userName ? `${userName}, ` : '';

    if (intent.type === 'unknown') {
      return this.smallTalkService.handle(prompt, language, userName, userId);
    }

    // Check for ambiguity (deterministic V1 only for now)
    if (intent.type === 'command') {
      const allMatches = await this.findMatchingDevices(prompt, userId);
      if (allMatches.length > 1) {
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

        return {
          type: 'clarification',
          message: language === 'en' ? "I found several devices that match." : "Encontré varios dispositivos que coinciden.",
          clarification: {
            question: language === 'en' ? "Which one do you want to control?" : "¿Cuál quieres controlar?",
            options,
            pendingAction: {
              command: intent.type === 'command' ? intent.command : undefined,
              targetId: undefined,
              originalPrompt: prompt
            }
          }
        };
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

      return {
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
      };
    }

    // E) Execution
    const correlationId = `assistant:chat:${Date.now()}`;
    if (intent.type === 'scene') {
      const scene = await this.sceneRepository.findSceneById(intent.target);
      if (!scene) return { type: 'error', message: language === 'en' ? "Scene not found." : "Escena no encontrada." };

      const result = await this.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });

      // Clear pending confirmation if successful
      this.clearPendingAction(userId).catch(() => {});

      // Record learning event
      this.learningService.recordSceneUsed(userId, scene, prompt).catch(() => {});

      return {
        type: 'execution',
        message: language === 'en' ? "Executing scene..." : "Ejecutando escena...",
        execution: result
      };
    }

    if (intent.type === 'command') {
      try {
        const device = await this.deviceRepository.findDeviceById(intent.deviceId);
        const deviceName = device?.name ?? intent.deviceId;
        const result = await this.executeSingleCommand(intent.deviceId, intent.command, intent.prompt, correlationId);
        
        if (result.status === 'failed') {
          this.learningService.recordCommandResult(userId, intent.deviceId, false, result.actions[0]?.error || 'Unknown error').catch(() => {});
          return {
            type: 'error',
            message: result.actions[0]?.userMessage || result.actions[0]?.error || (language === 'en' ? "Execution failed." : "La ejecución falló."),
            execution: result
          };
        }

        // Clear pending confirmation
        this.clearPendingAction(userId).catch(() => {});

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

        return {
          type: 'execution',
          message: this.buildCommandSuccessMessage(intent.command, deviceName, userName, language),
          execution: result
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          type: 'error',
          message: errorMessage || (language === 'en' ? "Unknown error during execution." : "Error desconocido durante la ejecución.")
        };
      }
    }

    if (intent.type === 'multi_command') {
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

        this.clearPendingAction(userId).catch(() => {});
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities,
          timestamp: new Date().toISOString()
        }).catch(() => {});

        return {
          type: 'execution',
          message,
          execution: {
            sceneId: 'multi_command',
            status: failures.length === 0 ? 'success' : 'failed',
            actions: results.flatMap(r => r.result.actions)
          }
        };

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          type: 'error',
          message: errorMessage || (language === 'en' ? "Unknown error during execution." : "Error desconocido durante la ejecución.")
        };
      }
    }

    return {
      type: 'error',
      message: language === 'en' ? "Unknown intent type." : "Tipo de intención desconocido."
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

  private resolveSelectionFromMemory(normalized: string, options: { id: string; label: string }[], language: string): string | null {
    // Check indices
    const indexTriggers = [
      { triggers: ['la primera', 'el primero', 'primera', 'primero', 'the first', 'first one'], index: 0 },
      { triggers: ['la segunda', 'el segundo', 'segunda', 'segundo', 'the second', 'second one'], index: 1 },
      { triggers: ['la tercera', 'el tercero', 'tercera', 'tercero', 'the third', 'third one'], index: 2 },
    ];

    for (const match of indexTriggers) {
      if (match.triggers.some(t => normalized.includes(t))) {
        return options[match.index]?.id || null;
      }
    }

    // Check by name similarity in options
    for (const opt of options) {
      const label = opt.label.toLowerCase();
      const normLabel = this.normalizePrompt(label);
      if (normalized.includes(normLabel) || normalized.includes(label)) return opt.id;
    }

    return null;
  }

  private inferCommandFromPrompt(prompt: string): DeviceCommandV1 | undefined {
    const normalized = this.normalizePrompt(prompt);
    if (normalized.includes('apaga') || normalized.includes('off') || normalized.includes('cierra')) return 'turn_off';
    if (normalized.includes('enciende') || normalized.includes('prende') || normalized.includes('on') || normalized.includes('abre')) return 'turn_on';
    return undefined;
  }

  private isAliasCreation(normalized: string): boolean {
    // Patrones explícitos ES
    if (normalized.includes('cuando diga') && (normalized.includes('me refiero a') || normalized.includes('entiende'))) return true;
    if (normalized.includes('guarda') && normalized.includes('como alias')) return true;
    if (normalized.includes('crea alias')) return true;
    if (normalized.includes('llama') && normalized.includes(' a ')) return true;

    // Patrones explícitos EN
    if (normalized.includes('when i say') && normalized.includes('i mean')) return true;
    if (normalized.includes('save') && normalized.includes('as alias')) return true;
    if (normalized.includes('create alias')) return true;
    if (normalized.includes('call ') && !normalized.includes('call me')) return true;

    return false;
  }

  private async handleAliasCreation(normalized: string, userId: string, language: string): Promise<AssistantConversationResponse> {
    // Simple pattern matching for aliases: "llama a [device/room] [alias]"
    // Or "cuando diga [alias] me refiero a [target]"
    
    // Pattern 1: "cuando diga X me refiero a Y"
    const match1 = normalized.match(/(?:cuando diga|when i say) (.+) (?:me refiero a|i mean) (.+)/);
    if (match1) {
      const alias = match1[1].trim();
      const targetName = match1[2].trim();
      return await this.tryCreateAlias(userId, alias, targetName, language);
    }

    // Pattern 2: "llama a X Y" (e.g. "llama a esta luz escritorio")
    const match2 = normalized.match(/(?:llama a|call) (.+) (.+)/);
    if (match2) {
      const targetName = match2[1].trim();
      const alias = match2[2].trim();
      return await this.tryCreateAlias(userId, alias, targetName, language);
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? "I couldn't understand the alias you want to create. Try: 'when I say [alias] I mean [device name]'."
        : "No pude entender el alias que quieres crear. Prueba con: 'cuando diga [alias] me refiero a [nombre del dispositivo]'."
    };
  }

  private async tryCreateAlias(userId: string, alias: string, targetName: string, language: string): Promise<AssistantConversationResponse> {
    const devices = await this.deviceRepository.findAll();
    
    // Safety: check if alias conflicts with an existing device name
    const conflict = devices.find(d => this.normalizePrompt(d.name) === this.normalizePrompt(alias));
    if (conflict) {
      return {
        type: 'answer',
        message: language === 'en'
          ? `I cannot use '${alias}' as an alias because it is already the name of an existing device.`
          : `No puedo usar '${alias}' como alias porque ya es el nombre de un dispositivo existente.`
      };
    }

    const targetDevice = devices.find(d => this.normalizePrompt(d.name) === this.normalizePrompt(targetName));
    if (targetDevice) {
      await this.memoryService.setAlias(userId, alias, targetDevice.name);
      this.learningService.recordAliasCreated(userId, alias, targetDevice.name).catch(() => {});
      return {
        type: 'answer',
        message: language === 'en'
          ? `Got it. From now on, when you say '${alias}', I'll know you mean ${targetDevice.name}.`
          : `Entendido. De ahora en adelante, cuando digas '${alias}', sabré que te refieres a ${targetDevice.name}.`
      };
    }

    // Try rooms
    const homeIds = [...new Set(devices.map(d => d.homeId).filter((hid): hid is string => Boolean(hid)))];
    const roomLists = await Promise.all(homeIds.map(hid => this.roomRepository.findRoomsByHomeId(hid)));
    const allRooms = roomLists.flat();
    const targetRoom = allRooms.find(r => this.normalizePrompt(r.name) === this.normalizePrompt(targetName));
    
    if (targetRoom) {
      await this.memoryService.setAlias(userId, alias, targetRoom.name);
      this.learningService.recordAliasCreated(userId, alias, targetRoom.name).catch(() => {});
      return {
        type: 'answer',
        message: language === 'en'
          ? `Got it. When you say '${alias}', I'll understand you mean the room ${targetRoom.name}.`
          : `Entendido. Cuando digas '${alias}', entenderé que te refieres a la estancia ${targetRoom.name}.`
      };
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? `I couldn't find a device or room named '${targetName}' to create the alias.`
        : `No pude encontrar un dispositivo o estancia llamado '${targetName}' para crear el alias.`
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
        ? 'Yes. In HomePilot, you can say "room", "area", or "space". I’ll treat them as references to where your devices are located.'
        : 'Sí, en HomePilot puedes decir "cuarto", "habitación", "estancia" o "zona". Los usaré como referencias al espacio donde están tus dispositivos.'
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

      for (const room of allRooms) {
        const normRoom = this.normalizePrompt(room.name);
        if (normalized.includes(normRoom)) {
          selectedRoom = room;
          break;
        }
        // Synonym substitution: try replacing room-type keywords
        const roomKeywords = ['cuarto', 'habitacion', 'estancia', 'zona', 'room', 'dormitorio'];
        for (const keyword of roomKeywords) {
          const replaced = normRoom.replace(/\b(cuarto|habitacion|estancia|zona|room|dormitorio)\b/g, keyword);
          if (normalized.includes(replaced)) {
            selectedRoom = room;
            break;
          }
        }
        if (selectedRoom) break;
      }

      // --- Infer command ---
      const command = this.inferCommandFromPrompt(normalized) || 'turn_off';

      // --- Room not found ---
      if (!selectedRoom) {
        const mentionedRoom = this.extractMentionedRoomName(normalized);
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[DRAFT DEBUG] Room not found. Prompt: "${normalized}"`);
          console.debug(`[DRAFT DEBUG] Available rooms:`, allRooms.map((r: Room) => ({ id: r.id, name: r.name })));
        }
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find the room "${mentionedRoom || 'specified'}". You can ask me "what rooms do you know".`
            : `No encontré la estancia "${mentionedRoom || 'especificada'}". Puedes preguntarme "qué estancias conoces".`
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
      const homeId = selectedRoom.homeId || controllableDevices[0]?.homeId || 'system';

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
  private isControllableDevice(device: Device, command: DeviceCommandV1): boolean {
    // 1. Skip unavailable devices
    const rawState = device.lastKnownState;
    if (rawState && typeof rawState['state'] === 'string' && rawState['state'] === 'unavailable') return false;

    const type = device.type.toLowerCase();
    const name = device.name.toLowerCase();

    // 2. Always exclude pure sensors — these are never controllable
    if (type === 'sensor' || type === 'binary_sensor') return false;
    if (name.includes('sensor') && !name.includes('luz') && !name.includes('foco')) return false;

    // 3. Type-based check — reliable for both HA and local integrations
    const TURN_TYPES = ['light', 'switch', 'outlet', 'dimmer'];
    const COVER_COMMANDS = ['open', 'close', 'stop', 'set_position'];

    if (TURN_TYPES.includes(type) && ['turn_on', 'turn_off', 'toggle'].includes(command)) return true;
    if (type === 'cover' && COVER_COMMANDS.includes(command)) return true;

    // 4. Name-based heuristic for unlabeled controllable devices
    const controllableNames = ['luz', 'foco', 'lampara', 'interruptor', 'enchufe', 'tomacorriente', 'apagador'];
    if (controllableNames.some(kw => name.includes(kw))) return true;

    // 5. Domain validator as final fallback (handles explicit capabilities)
    const validation = validateDeviceCommand(device, { name: command, params: {} });
    return validation.valid;
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

  private extractMentionedRoomName(normalized: string): string | null {
    const keywords = ['cuarto', 'estancia', 'habitacion', 'sala', 'cocina', 'baño', 'patio', 'comedor', 'dormitorio'];
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        const parts = normalized.split(kw);
        if (parts.length > 1) {
          const rest = parts[1].trim().split(' ')[0];
          return rest ? `${kw} ${rest}` : kw;
        }
      }
    }
    return null;
  }

  private async handleSelection(request: AssistantConverseRequest, language: string): Promise<AssistantConversationResponse> {
    const correlationId = `assistant:chat:selection:${Date.now()}`;
    const userId = request.userId || 'system';
    const targetId = request.selectedOptionId === 'confirm' ? request.pendingAction?.targetId : request.selectedOptionId;

    if (!targetId) {
      return { type: 'error', message: language === 'en' ? "Missing target for selection." : "Falta el objetivo para la selección." };
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
        this.clearPendingAction(userId).catch(() => {});
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities: scene.actions.map(a => ({ id: a.deviceId, name: 'device', type: 'device', roomId: null })),
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }

      return {
        type: 'execution',
        message: result.status === 'success'
          ? (language === 'en' ? `Executed scene ${scene.name}.` : `Ejecuté la escena ${scene.name}.`)
          : (language === 'en' ? "Execution failed." : "La ejecución falló."),
        execution: result
      };
    }

    if (request.pendingAction?.command) {
      const device = await this.deviceRepository.findDeviceById(targetId);
      const deviceName = device?.name ?? targetId;
      
      if (device) {
        this.learningService.recordClarificationSelected(userId, device.id, device.name, 'device', request.pendingAction.originalPrompt).catch(() => {});
      }
      
      const result = await this.executeSingleCommand(targetId, request.pendingAction.command, request.pendingAction.originalPrompt, correlationId);
      
      if (result.status === 'success') {
        this.clearPendingAction(userId).catch(() => {});
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'command',
          entities: device ? [{ id: device.id, name: device.name, type: device.type, roomId: device.roomId }] : [],
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }

      return {
        type: 'execution',
        message: result.status === 'success' 
          ? this.buildCommandSuccessMessage(request.pendingAction.command, deviceName, request.userName || null, language)
          : (language === 'en' ? "Execution failed." : "La ejecución falló."),
        execution: result
      };
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
      .replace(/\bk tal\b/g, "que tal");

    // Strip polite prefixes so intent matching works on the core request
    const politePrefixes = [
      'puedes ', 'podrias ', 'me ayudas a ', 'me ayudas ',
      'quiero que ', 'haz que ', 'haz ', 'por favor '
    ];
    for (const prefix of politePrefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
        break;
      }
    }
    return normalized;
  }

  private isNameQuery(normalized: string): boolean {
    const triggers = [
      "como te llamas", "cómo te llamas", "cuál es tu nombre", "cual es tu nombre",
      "quién eres", "quien eres",
      "what is your name", "whats your name", "who are you"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isHelpQuery(normalized: string): boolean {
    const triggers = ["ayuda", "help"];
    return triggers.some(t => normalized === t || normalized.startsWith(t + " "));
  }

  private isPresentation(normalized: string): boolean {
    const triggers = [
      "qué puedes hacer", "que puedes hacer", "preséntate", "presentate",
      "what can you do", "introduce yourself"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private isDateTimeQuery(normalized: string): boolean {
    const triggers = [
      "qué fecha es hoy", "que fecha es hoy", "qué hora es", "que hora es",
      "what date is today", "what time is it"
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private handleDateTimeQuery(prompt: string, language: string): AssistantConversationResponse {
    const now = new Date();
    const dateStr = now.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString(language === 'en' ? 'en-US' : 'es-ES', { 
      hour: '2-digit', minute: '2-digit' 
    });

    let message = "";
    if (prompt.includes('fecha') || prompt.includes('date')) {
      message = language === 'en' ? `Today is ${dateStr}.` : `Hoy es ${dateStr}.`;
    } else {
      message = language === 'en' ? `It is ${timeStr}.` : `Son las ${timeStr}.`;
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

  private isLikelyHomeControlPrompt(normalized: string): boolean {
    const conversationalPrefixes = [
      'que opinas', 'dime', 'cuentame', 'como funciona', 'explicame', 'hablame', 'sabes algo'
    ];
    if (conversationalPrefixes.some(prefix => normalized.includes(prefix))) {
      return false;
    }

    const triggers = [
      'prende', 'apaga', 'enciende', 'activa', 'desactiva', 'abre', 'cierra', 'sube', 'baja', 'toggle', 'turn on', 'turn off', 'open', 'close',
      'encendido', 'apagado', 'prendido', 'on', 'off', 'luz', 'luces', 'light', 'lights', 'dispositivos', 'estado',
      'esa', 'eso', 'esas', 'esos', 'that', 'those', 'them',
      'escena', 'rutina', 'automatizacion', 'scene', 'routine', 'automation',
      'cuando diga', 'llama a', 'when i say',
      'crea', 'haz', 'create', 'make'
    ];
    return triggers.some(t => normalized.includes(t));
  }

  /**
   * Builds a Map<roomId, roomName> by querying rooms for each unique homeId
   * found in the provided devices. This avoids the 'system' hardcode bug.
   */
  private async buildRoomNameMap(devices: readonly Device[]): Promise<Map<string, string>> {
    const homeIds = [...new Set(devices.map(d => d.homeId).filter((hid): hid is string => Boolean(hid)))];
    const roomLists = await Promise.all(homeIds.map(hid => this.roomRepository.findRoomsByHomeId(hid)));
    const map = new Map<string, string>();
    for (const roomList of roomLists) {
      for (const r of roomList) {
        map.set(r.id, r.name);
      }
    }
    return map;
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
    entitiesFromMemory?: AssistantMemoryEntity[]
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

    // Build room name map from actual device homeIds — fixes 'system' hardcode bug
    const roomMap = await this.buildRoomNameMap(allDevices);

    const isLightsOnly = normalized.includes('luz') || normalized.includes('luces') || normalized.includes('light');

    // Detect keywords
    const onKeywords = ['encendido', 'encendidos', 'encendida', 'encendidas', 'prendido', 'prendidos', 'on', 'active', 'enabled'];
    const offKeywords = ['apagado', 'apagados', 'apagada', 'apagadas', 'off', 'inactive', 'disabled'];

    const isOnQuery = onKeywords.some(kw => normalized.includes(kw));
    const isOffQuery = offKeywords.some(kw => normalized.includes(kw));
    const isCompound = isOnQuery && isOffQuery;
    const hasNoExplicitState = !isOnQuery && !isOffQuery;

    // Detect target room from the resolved map
    let targetRoomId: string | null = null;
    let targetRoomName: string | null = null;

    for (const [roomId, roomName] of roomMap.entries()) {
      const normRoom = this.normalizePrompt(roomName);
      if (normalized.includes(normRoom)) {
        targetRoomId = roomId;
        targetRoomName = roomName;
        break;
      }
    }

    // Filtering
    let filteredDevices = allDevices;
    if (!entitiesFromMemory || entitiesFromMemory.length === 0) {
      if (targetRoomId) {
        filteredDevices = allDevices.filter(d => d.roomId === targetRoomId);
      } else {
        const roomTokens = ['sala', 'cocina', 'cuarto', 'master', 'habitacion', 'living', 'kitchen', 'bedroom', 'bano'];
        const promptHasRoomToken = roomTokens.some(t => normalized.includes(t));
        if (promptHasRoomToken) {
          filteredDevices = allDevices.filter(d => {
            const name = this.normalizePrompt(d.name);
            return roomTokens.some(t => normalized.includes(t) && name.includes(t));
          });
        }
      }

      // Filter by type if lights only
      if (isLightsOnly) {
        filteredDevices = filteredDevices.filter(d => {
          const name = d.name.toLowerCase();
          const hasLightKeyword = name.includes('luz') || name.includes('light');
          const hasLightCapability = d.capabilities?.some(c => c.type === 'light');
          return d.type === 'light' || hasLightKeyword || hasLightCapability;
        });
      }
    }

    // If no devices match the query at all
    if (filteredDevices.length === 0) {
      if (targetRoomName || normalized.includes('bano') || normalized.includes('cocina')) {
        const area = targetRoomName || (normalized.includes('bano') ? (language === 'en' ? 'Bathroom' : 'Baño') : (language === 'en' ? 'Kitchen' : 'Cocina'));
        return {
          type: 'answer',
          message: language === 'en'
            ? `I couldn't find any ${isLightsOnly ? 'lights' : 'devices'} in ${area}.`
            : `No encontré ${isLightsOnly ? 'luces' : 'dispositivos'} en ${area}.`
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
    const isRoomQuery = normalized.includes('cuarto') || normalized.includes('habitacion') || normalized.includes('donde');
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

  private async findMatchingDevices(prompt: string, userId: string = 'system'): Promise<Device[]> {
    const normalized = this.normalizePrompt(prompt);
    const devices = await this.deviceRepository.findAll();
    
    // 1. Check for Exact Match first (highest priority)
    const exactMatch = devices.find(d => this.normalizePrompt(d.name) === normalized);
    if (exactMatch) return [exactMatch];

    // 2. Score-based matching for fuzzy/partial matches
    const scored = devices.map(d => {
      const name = this.normalizePrompt(d.name);
      let score = 0;

      if (normalized.includes(name)) score = 50;
      else if (name.split(' ').some(token => normalized.includes(token))) score = 10;

      return { device: d, score };
    }).filter(item => item.score > 0);

    if (scored.length === 0) return [];

    // 3.usage-based ranking for remaining candidates
    const mostUsed = await this.learningService.getMostUsedDevices(userId);
    const usageMap = new Map(mostUsed.map(u => [u.entityId, u.count]));

    scored.sort((a, b) => {
      // First by match score
      if (b.score !== a.score) return b.score - a.score;
      // Then by usage count
      const usageA = usageMap.get(a.device.id) || 0;
      const usageB = usageMap.get(b.device.id) || 0;
      return usageB - usageA;
    });

    // 4. Return Top 3
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
        const scene = await this.sceneRepository.findSceneById(targetId);
        if (scene) {
          scene.name = payload.newName as string;
          scene.updatedAt = new Date().toISOString();
          await this.sceneRepository.saveScene(scene);
          await this.clearPendingAction(userId);
          return { type: 'answer', message: language === 'en' ? `Ready, scene renamed to "${scene.name}".` : `Listo, renombré la escena a "${scene.name}".` };
        }
      }

      if (type === 'toggle_automation') {
        const auto = await this.automationRepository.findById(targetId);
        if (auto) {
          const updatedAuto = { ...auto, enabled: payload.enabled as boolean, updatedAt: new Date().toISOString() };
          await this.automationRepository.save(updatedAuto);
          await this.clearPendingAction(userId);
          return { type: 'answer', message: language === 'en' ? `Ready, automation "${auto.name}" ${payload.enabled ? 'enabled' : 'disabled'}.` : `Listo, ${payload.enabled ? 'activé' : 'desactivé'} la automatización "${auto.name}".` };
        }
      }

      if (type === 'edit_scene') {
        const scene = await this.sceneRepository.findSceneById(targetId);
        if (scene) {
          if (payload.mode === 'add') {
            scene.actions.push({
              deviceId: payload.deviceId as string,
              command: { name: payload.command as DeviceCommandV1, params: {} }
            });
          } else if (payload.mode === 'remove') {
            scene.actions = scene.actions.filter(a => a.deviceId !== payload.deviceId);
          }
          scene.updatedAt = new Date().toISOString();
          await this.sceneRepository.saveScene(scene);
          await this.clearPendingAction(userId);
          return { type: 'answer', message: language === 'en' ? `Ready, updated scene "${scene.name}".` : `Listo, actualicé la escena "${scene.name}".` };
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

  private formatMultiCommandSummary(results: ExecutedCommandResult[], language: string): string {
    const successes = results.filter(r => r.result.status === 'success');
    const failures = results.filter(r => r.result.status === 'failed');

    if (failures.length === 0) {
      if (language === 'en') {
        const details = results.map(r => `${r.action.command === 'turn_on' ? 'turned on' : 'turned off'} ${r.deviceName}`).join(' and ');
        return `I executed ${results.length} actions: ${details}.`;
      } else {
        const details = results.map(r => `${r.action.command === 'turn_on' ? 'encendí' : 'apagué'} ${r.deviceName}`).join(' y ');
        return `Ejecuté ${results.length} acciones: ${details}.`;
      }
    }

    if (successes.length === 0) {
      return language === 'en' 
        ? `Failed to execute any actions. Errors: ${failures.map(f => `${f.deviceName}: ${f.result.actions[0]?.error}`).join(', ')}`
        : `No pude ejecutar ninguna acción. Errores: ${failures.map(f => `${f.deviceName}: ${f.result.actions[0]?.error}`).join(', ')}`;
    }

    // Partial failure
    if (language === 'en') {
      return `Executed ${successes.length} of ${results.length} actions. Failed ${failures[0].deviceName}: ${failures[0].result.actions[0]?.error}.`;
    } else {
      return `Ejecuté ${successes.length} de ${results.length} acciones. Falló ${failures[0].deviceName}: ${failures[0].result.actions[0]?.error}.`;
    }
  }

  private async executeSingleCommand(deviceId: string, command: DeviceCommandV1, prompt: string, correlationId: string): Promise<SceneExecutionResult> {
    const transientScene: Scene = {
      id: `assistant-chat-transient-${Date.now()}`,
      homeId: 'system',
      roomId: null,
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

  private async resolvePronounIntent(normalized: string, memory: AssistantMemoryState | null, language: string): Promise<Intent | { type: 'clarificationRequired'; options: Array<{ id: string; label: string }> } | null> {
    const patterns = [
      { regex: /(^|\s)(apagal[ao]s?|apaga esa|apaga la misma)(\s|$)/, command: 'turn_off' as const },
      { regex: /(^|\s)(enciendel[ao]s?|enciende esa|enciende la misma|prendel[ao]s?|prende esa|prende la misma)(\s|$)/, command: 'turn_on' as const },
    ];

    const match = patterns.find(p => p.regex.test(normalized));
    if (!match) return null;

    if (!memory || !memory.entities || memory.entities.length === 0) return null;

    if (memory.entities.length > 1) {
      return {
        type: 'clarificationRequired',
        options: memory.entities.map(e => ({ id: e.id, label: e.name }))
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
}
