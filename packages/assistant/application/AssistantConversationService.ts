import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { FailureInsightService } from '../../devices/application/FailureInsightService';
import { Scene } from '../../devices/domain/Scene';
import { Device } from '../../devices/domain/types';
import { IntentInterpreterPort, Intent } from './ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';
import { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';

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
    private readonly sceneRepository: SceneRepository,
    private readonly smallTalkService: AssistantSmallTalkPort
  ) {}

  public async converse(request: AssistantConverseRequest, language: string = 'es'): Promise<AssistantConversationResponse> {
    // A) Selected Option Flow
    if (request.selectedOptionId) {
      return this.handleSelection(request, language);
    }

    const prompt = request.prompt.trim();
    const normalized = this.normalizePrompt(prompt);

    // B) Greetings
    if (this.isGreeting(normalized)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "Hi, I’m ready to help with your home. You can ask what is on or ask me to control a light, scene, or device."
          : "Hola, estoy listo para ayudarte con tu casa. Puedes preguntarme qué está encendido o pedirme que controle alguna luz, escena o dispositivo."
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
      return this.handleStateQuery(normalized, language);
    }

    // C) Ambiguity & Regular Intent Flow
    const intent = await this.intentInterpreter.interpret(request.prompt);

    if (intent.type === 'unknown') {
      return this.smallTalkService.handle(prompt, language);
    }

    // Check for ambiguity (deterministic V1 only for now)
    if (intent.type === 'command') {
      const allMatches = await this.findMatchingDevices(request.prompt);
      if (allMatches.length > 1) {
        return {
          type: 'clarification',
          message: language === 'en' ? "I found several devices that match." : "Encontré varios dispositivos que coinciden.",
          clarification: {
            question: language === 'en' ? "Which one do you want to control?" : "¿Cuál quieres controlar?",
            options: allMatches.map(d => ({
              id: d.id,
              label: d.name,
              kind: 'device'
            })),
            pendingAction: {
              command: intent.command as DeviceCommandV1,
              targetId: undefined, // Will be set by the option selection
              originalPrompt: request.prompt
            }
          }
        };
      }
    }

    // D) Confirmation Policy
    const preview = await this.confirmationPolicy.evaluate(intent, language);
    if (preview.requiresConfirmation && request.confirmed !== true) {
      return {
        type: 'clarification',
        message: `${preview.reason} ${preview.summary}`.trim(),
        clarification: {
          question: language === 'en' ? "Are you sure?" : "¿Estás seguro?",
          options: [
            { id: 'confirm', label: language === 'en' ? "Yes, proceed" : "Sí, adelante", kind: 'device' }
          ],
          pendingAction: {
            command: intent.type === 'command' ? intent.command as DeviceCommandV1 : undefined,
            targetId: intent.type === 'command' ? intent.deviceId : intent.target,
            originalPrompt: request.prompt
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
      return {
        type: 'execution',
        message: language === 'en' ? "Executing scene..." : "Ejecutando escena...",
        execution: result
      };
    }

    if (intent.type === 'command') {
      try {
        const result = await this.executeSingleCommand(intent.deviceId, intent.command as DeviceCommandV1, intent.prompt, correlationId);
        if (result.status === 'failed') {
          return {
            type: 'error',
            message: result.actions[0]?.userMessage || result.actions[0]?.error || (language === 'en' ? "Execution failed." : "La ejecución falló."),
            execution: result
          };
        }
        return {
          type: 'execution',
          message: language === 'en' ? "Action completed." : "Acción completada.",
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
    return prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[¿?¡!.,]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")            // Normalize spaces
      .trim();
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
      "hola", "buenas", "buenos dias", "buenos días", "buenas tardes", "buenas noches", "qué tal", "que tal",
      "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "gracias", "thanks", "thank you"
    ];
    // Exact match or starts with greeting followed by space/punctuation
    return greetings.some(g => normalized === g || normalized.startsWith(g + " "));
  }

  private isStateQuery(normalized: string): boolean {
    const queries = [
      "que esta encendido", "que esta apagado",
      "luces encendidas", "luces apagadas",
      "que luces estan encendidas", "que luces estan apagadas",
      "luces estan encendidas", "luces estan apagadas",
      "what is on", "what is off",
      "which lights are on", "which lights are off",
      "que tengo prendido", "que tengo apagado",
      "que hay encendido", "que hay apagado",
      "que dispositivos estan encendidos", "que dispositivos estan apagados"
    ];
    return queries.some(q => normalized.includes(q));
  }

  private async handleStateQuery(normalized: string, language: string): Promise<AssistantConversationResponse> {
    const devices = await this.deviceRepository.findAll();
    
    const isLightsOnly = normalized.includes('luz') || normalized.includes('luces') || normalized.includes('light');
    
    // Check if it's an "on" query safely
    const onKeywords = ['encendido', 'encendidos', 'encendida', 'encendidas', 'prendido', 'prendidos', 'on', 'active', 'enabled'];
    const isOnQuery = onKeywords.some(kw => {
      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(normalized);
      }
      return normalized.includes(kw);
    });
    
    const matches = devices.filter(d => {
      const isOn = d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on');
      const matchesOn = isOnQuery ? isOn : !isOn;
      if (!matchesOn) return false;

      if (isLightsOnly) {
        const name = d.name.toLowerCase();
        const hasLightKeyword = name.includes('luz') || name.includes('light');
        const hasLightCapability = d.capabilities?.some(c => c.type === 'light');
        
        return d.type === 'light' || hasLightKeyword || hasLightCapability;
      }
      return true;
    });

    if (matches.length === 0) {
      const typeLabel = isLightsOnly 
        ? (language === 'en' ? 'lights' : 'luces')
        : (language === 'en' ? 'devices' : 'dispositivos');
      const stateLabel = isOnQuery
        ? (language === 'en' ? 'on' : 'encendidos')
        : (language === 'en' ? 'off' : 'apagados');

      return {
        type: 'answer',
        message: language === 'en' 
          ? `I didn't find any ${typeLabel} ${stateLabel} at the moment.`
          : `No encontré ${typeLabel} ${stateLabel} en este momento.`
      };
    }

    const list = matches.map(d => d.name).join(', ');
    const count = matches.length;
    
    const typeLabel = isLightsOnly 
      ? (count === 1 ? (language === 'en' ? 'light' : 'luz') : (language === 'en' ? 'lights' : 'luces'))
      : (count === 1 ? (language === 'en' ? 'device' : 'dispositivo') : (language === 'en' ? 'devices' : 'dispositivos'));
    
    const stateLabel = isOnQuery
      ? (language === 'en' ? 'on' : 'encendido(s)')
      : (language === 'en' ? 'off' : 'apagado(s)');

    let message = "";
    if (language === 'en') {
      message = count === 1
        ? `You have 1 ${typeLabel} ${stateLabel}: ${list}.`
        : `You have ${count} ${typeLabel} ${stateLabel}: ${list}.`;
    } else {
      message = count === 1
        ? `Tienes 1 ${typeLabel} ${stateLabel}: ${list}.`
        : `Tienes ${count} ${typeLabel} ${stateLabel}: ${list}.`;
    }

    return {
      type: 'answer',
      message
    };
  }



  private async findMatchingDevices(prompt: string): Promise<Device[]> {
    const normalized = this.normalizePrompt(prompt);
    const devices = await this.deviceRepository.findAll();
    return devices.filter(d => {
      const name = this.normalizePrompt(d.name);
      // Basic match logic mirrored from IntentInterpreterService
      if (normalized.includes('sala') && !name.includes('sala')) return false;
      if (normalized.includes('cocina') && !name.includes('cocina')) return false;
      if (normalized.includes('cuarto') && !name.includes('cuarto')) return false;
      if (normalized.includes('escritorio') && !name.includes('escritorio')) return false;
      
      return name.includes('luz') || name.includes('lampara') || name.includes('foco');
    });
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
}
