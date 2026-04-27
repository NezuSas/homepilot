import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { AssistantDraftService } from './AssistantDraftService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { Scene } from '../../devices/domain/Scene';
import { Device } from '../../devices/domain/types';
import type { IntentInterpreterPort } from './ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import { AssistantMemoryPort, AssistantMemoryEntity } from './ports/AssistantMemoryPort';
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
    private readonly draftService: AssistantDraftService
  ) {}

  public async converse(request: AssistantConverseRequest, language: string = 'es'): Promise<AssistantConversationResponse> {
    const t0 = Date.now();

    // A) Selected Option Flow
    if (request.selectedOptionId) {
      const result = await this.handleSelection(request, language);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] converse() selection path: ${Date.now() - t0}ms`);
      }
      return result;
    }

    const prompt = request.prompt.trim();
    const userId = request.userId || 'system';
    const userName = request.userName?.trim() || null;
    const namePrefix = userName ? `${userName}, ` : '';

    // V2: Load Contextual Memory & Aliases
    const t_mem = Date.now();
    const [memory, aliases] = await Promise.all([
      this.memoryService.getShortTermMemory(userId),
      this.memoryService.getAliases(userId)
    ]);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AssistantConversation] Memory load took ${Date.now() - t_mem}ms`);
    }

    // V2: Follow-up Resolution
    let activePrompt = prompt;
    const normalized = this.normalizePrompt(activePrompt);
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

        // A2: Check Pending Draft
        if (memory?.pendingDraft) {
          if (this.isPositiveConfirmation(normalized)) {
            try {
              await this.draftService.activateDraft(memory.pendingDraft.id, userId);
              await this.clearPendingAction(userId);
              return {
                type: 'answer',
                message: language === 'en' ? "Draft activated and saved." : "Borrador activado y guardado correctamente."
              };
            } catch (err: unknown) {
              return {
                type: 'error',
                message: language === 'en' ? "Failed to activate draft." : "No se pudo activar el borrador."
              };
            }
          } else if (this.isNegativeConfirmation(normalized)) {
            await this.clearPendingAction(userId);
            return {
              type: 'answer',
              message: language === 'en' ? "Draft discarded." : "Borrador descartado."
            };
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
          request.selectedOptionId = selectedId;
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

    // G) State Queries
    if (this.isStateQuery(normalized)) {
      const t_state = Date.now();
      const result = await this.handleStateQuery(normalized, language, userName, userId, followUp.referencesMemory ? memory?.entities : undefined);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConversation] StateQuery path took ${Date.now() - t_state}ms`);
      }
      return result;
    }

    // G2) Alias Creation Commands
    if (this.isAliasCreation(normalized)) {
      return await this.handleAliasCreation(normalized, userId, language);
    }

    // G3) Draft Creation (Scenes/Automations)
    if (this.isDraftCreation(normalized)) {
      return await this.handleDraftCreation(normalized, language, userId);
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
    const intent = await this.intentInterpreter.interpret(activePrompt);

    // V2: If we interpreted a NEW intent, and there was a pending action, clear it to avoid context mixing
    if (intent && intent.type !== 'unknown' && (memory?.pendingIntent || memory?.pendingDraft)) {
      await this.clearPendingAction(userId);
    }

    if (!intent) {
      return await this.executeIntent({ type: 'unknown' }, request, language, userId, userName, activePrompt);
    }

    return await this.executeIntent(intent, request, language, userId, userName, activePrompt);
  }

  private async executeIntent(
    intent: any, 
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
      const allMatches = await this.findMatchingDevices(prompt);
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
              command: intent.command as DeviceCommandV1,
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
            command: intent.type === 'command' ? intent.command as DeviceCommandV1 : undefined,
            targetId: intent.type === 'command' ? intent.deviceId : intent.target,
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
        const result = await this.executeSingleCommand(intent.deviceId, intent.command as DeviceCommandV1, intent.prompt, correlationId);
        
        if (result.status === 'failed') {
          return {
            type: 'error',
            message: result.actions[0]?.userMessage || result.actions[0]?.error || (language === 'en' ? "Execution failed." : "La ejecución falló."),
            execution: result
          };
        }

        // Clear pending confirmation
        this.clearPendingAction(userId).catch(() => {});

        // V2: Save to memory
        this.memoryService.saveShortTermMemory(userId, {
          lastQueryType: 'execution',
          entities: [{ id: intent.deviceId, name: deviceName, type: 'device', roomId: device?.roomId || null }],
          timestamp: new Date().toISOString()
        }).catch(() => {});

        return {
          type: 'execution',
          message: this.buildCommandSuccessMessage(intent.command as DeviceCommandV1, deviceName, userName, language),
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
      if (normalized.includes(label)) return opt.id;
    }

    return null;
  }

  private isAliasCreation(normalized: string): boolean {
    const triggers = [
      'cuando diga', 'me refiero a', 'llama a', 'es mi',
      'when i say', 'i mean', 'call this', 'is my'
    ];
    return triggers.some(t => normalized.includes(t));
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

  private isDraftCreation(normalized: string): boolean {
    const triggers = [
      'crea una escena', 'crea un modo', 'haz una rutina', 'crea una rutina',
      'create a scene', 'create a mode', 'make a routine'
    ];
    return triggers.some(t => normalized.includes(t));
  }

  private async handleDraftCreation(normalized: string, language: string, userId: string = 'system'): Promise<AssistantConversationResponse> {
    // Determine type and basic info (mock/heuristic for now, could use LLM)
    const isScene = normalized.includes('escena') || normalized.includes('scene');
    const name = language === 'en' ? 'New Routine' : 'Nueva Rutina';
    const fingerprint = `draft:${userId}:${Date.now()}`;
    
    let draftId = '';
    if (isScene) {
      const draft = await this.draftService.createSceneDraft('system', null, name, [], fingerprint);
      draftId = draft.id;
    } else {
      const draft = await this.draftService.createAutomationDraft('system', name, {}, {}, fingerprint);
      draftId = draft.id;
    }

    await this.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'draft_creation',
      entities: [],
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
        ? `I've prepared a draft for that ${isScene ? 'scene' : 'routine'}.`
        : `He preparado un borrador para esa ${isScene ? 'escena' : 'rutina'}.`,
      clarification: {
        question: language === 'en' ? "Would you like to activate it now?" : "¿Quieres activarlo ahora?",
        options: [
          { id: 'confirm', label: language === 'en' ? "Yes, activate" : "Sí, activar", kind: isScene ? 'scene' : 'device' },
          { id: 'cancel', label: language === 'en' ? "No, discard" : "No, descartar", kind: isScene ? 'scene' : 'device' }
        ]
      }
    };
  }

  private async handleSelection(request: AssistantConverseRequest, language: string): Promise<AssistantConversationResponse> {
    const correlationId = `assistant:chat:selection:${Date.now()}`;
    const targetId = request.selectedOptionId === 'confirm' ? request.pendingAction?.targetId : request.selectedOptionId;

    if (!targetId) {
      return { type: 'error', message: language === 'en' ? "Missing target for selection." : "Falta el objetivo para la selección." };
    }
    
    // Check if it's a scene or device
    const scene = await this.sceneRepository.findSceneById(targetId);
    if (scene) {
      const result = await this.sceneExecutionService.execute(scene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId
      });
      return {
        type: 'execution',
        message: language === 'en' ? "Scene executed." : "Escena ejecutada.",
        execution: result
      };
    }

    if (request.pendingAction?.command) {
      const result = await this.executeSingleCommand(targetId, request.pendingAction.command, request.pendingAction.originalPrompt, correlationId);
      return {
        type: 'execution',
        message: result.status === 'success' 
          ? (language === 'en' ? "Action completed." : "Acción completada.") 
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
      'encendido', 'apagado', 'prendido', 'on', 'off', 'luces', 'dispositivos', 'estado',
      'esa', 'eso', 'esas', 'esos', 'that', 'those', 'them',
      'escena', 'rutina', 'automatizacion', 'scene', 'routine', 'automation',
      'cuando diga', 'me refiero a', 'llama a', 'es mi', 'when i say', 'i mean', 'call this',
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

  private async findMatchingDevices(prompt: string): Promise<Device[]> {
    const normalized = this.normalizePrompt(prompt);
    const devices = await this.deviceRepository.findAll();
    
    // Score-based matching
    const scored = devices.map(d => {
      const name = this.normalizePrompt(d.name);
      let score = 0;

      if (name === normalized) score = 100;
      else if (normalized.includes(name)) score = 50;
      else if (name.split(' ').some(token => normalized.includes(token))) score = 10;

      return { device: d, score };
    }).filter(item => item.score > 0);

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // If we have a clear top match (or multiple top matches with same score)
    if (scored.length > 0) {
      const topScore = scored[0].score;
      return scored.filter(item => item.score === topScore).map(item => item.device);
    }

    return [];
  }

  private buildCommandSuccessMessage(command: DeviceCommandV1, deviceName: string, userName: string | null, language: string): string {
    const namePrefix = userName ? `${userName}. ` : '';
    
    let actionES = 'controlé';
    let actionEN = 'controlled';
    
    if (command === 'turn_on') {
      actionES = 'encendí';
      actionEN = 'turned on';
    } else if (command === 'turn_off') {
      actionES = 'apagué';
      actionEN = 'turned off';
    }

    if (language === 'en') {
      return `Done, ${namePrefix}I ${actionEN} ${deviceName}.`;
    } else {
      return `Listo, ${namePrefix}${actionES.charAt(0).toUpperCase() + actionES.slice(1)} la luz ${deviceName} correctamente.`;
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
}
