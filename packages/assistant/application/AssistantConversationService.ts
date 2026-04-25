import { IntentInterpreterService } from './IntentInterpreterService';
import { AssistantConfirmationPolicy } from './AssistantConfirmationPolicy';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { FailureInsightService } from '../../devices/application/FailureInsightService';
import { Scene } from '../../devices/domain/Scene';
import { IntentInterpreterPort, Intent } from './ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';

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
      originalPrompt: string;
    };
  };
}

export interface AssistantConverseRequest {
  prompt: string;
  selectedOptionId?: string;
  pendingAction?: {
    command?: DeviceCommandV1;
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
    private readonly sceneRepository: SceneRepository
  ) {}

  public async converse(request: AssistantConverseRequest, language: string = 'es'): Promise<AssistantConversationResponse> {
    // A) Selected Option Flow
    if (request.selectedOptionId) {
      return this.handleSelection(request, language);
    }

    const prompt = request.prompt.toLowerCase().trim();

    // B) Greetings
    if (this.isGreeting(prompt)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "Hi, I’m ready to help with your home. You can ask what is on or ask me to control a light, scene, or device."
          : "Hola, estoy listo para ayudarte con tu casa. Puedes preguntarme qué está encendido o pedirme que controle alguna luz, escena o dispositivo."
      };
    }

    // C) Presentation / Capabilities
    if (this.isPresentation(prompt)) {
      return {
        type: 'answer',
        message: language === 'en'
          ? "I’m HomePilot, your local home assistant. I can help you check what devices are on or off, control lights, run scenes, and guide you when an action needs confirmation."
          : "Soy HomePilot, el asistente local de tu casa. Puedo ayudarte a consultar qué dispositivos están encendidos o apagados, controlar luces, ejecutar escenas y guiarte cuando una acción necesite confirmación."
      };
    }

    // D) Date/Time Queries
    if (this.isDateTimeQuery(prompt)) {
      return this.handleDateTimeQuery(prompt, language);
    }

    // E) State Queries
    if (this.isStateQuery(prompt)) {
      return this.handleStateQuery(prompt, language);
    }

    // C) Ambiguity & Regular Intent Flow
    const intent = await this.intentInterpreter.interpret(request.prompt);

    if (intent.type === 'unknown') {
      return {
        type: 'error',
        message: language === 'en' 
          ? "I could not understand exactly what you want to do. Try something like: \"turn on the living room light\"."
          : "No pude entender exactamente qué quieres hacer. Intenta con algo como: \"enciende la luz de la sala\"."
      };
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
        type: 'error',
        message: `${preview.reason} ${preview.summary}`.trim()
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
    
    // Check if it's a scene or device
    const scene = await this.sceneRepository.findSceneById(request.selectedOptionId!);
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
      const result = await this.executeSingleCommand(request.selectedOptionId!, request.pendingAction.command, request.pendingAction.originalPrompt, correlationId);
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

  private isPresentation(prompt: string): boolean {
    const triggers = [
      "qué puedes hacer", "que puedes hacer", "preséntate", "presentate", "quién eres", "quien eres",
      "what can you do", "introduce yourself", "who are you"
    ];
    return triggers.some(t => prompt.includes(t));
  }

  private isDateTimeQuery(prompt: string): boolean {
    const triggers = [
      "qué fecha es hoy", "que fecha es hoy", "qué hora es", "que hora es",
      "what date is today", "what time is it"
    ];
    return triggers.some(t => prompt.includes(t));
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

  private isGreeting(prompt: string): boolean {
    const greetings = [
      "hola", "buenas", "buenos dias", "buenos días", "buenas tardes", "buenas noches", "qué tal", "que tal",
      "hello", "hi", "hey", "good morning", "good afternoon", "good evening"
    ];
    // Exact match or starts with greeting followed by space/punctuation
    return greetings.some(g => prompt === g || prompt.startsWith(g + " ") || prompt.startsWith(g + ","));
  }

  private isStateQuery(prompt: string): boolean {
    const queries = [
      "qué está encendido", "que esta encendido",
      "qué está apagado", "que esta apagado",
      "luces encendidas", "luces apagadas",
      "what is on", "what is off",
      "which lights are on", "which lights are off"
    ];
    return queries.some(q => prompt.includes(q));
  }

  private async handleStateQuery(prompt: string, language: string): Promise<AssistantConversationResponse> {
    const devices = await this.deviceRepository.findAll();
    const normalized = prompt.toLowerCase();
    
    // Check if it's an "on" query safely
    const onKeywords = language === 'en' ? ['on', 'active', 'enabled'] : ['encendido', 'encendidos', 'encendida', 'encendidas', 'prendido', 'prendidos'];
    const isOnQuery = onKeywords.some(kw => {
      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(normalized);
      }
      return normalized.includes(kw);
    });
    
    const matches = devices.filter(d => {
      const isOn = d.lastKnownState && (d.lastKnownState.on === true || d.lastKnownState.state === 'on');
      return isOnQuery ? isOn : !isOn;
    });

    if (matches.length === 0) {
      return {
        type: 'answer',
        message: language === 'en' 
          ? `No devices are currently ${isOnQuery ? 'on' : 'off'}.`
          : `No hay dispositivos ${isOnQuery ? 'encendidos' : 'apagados'} en este momento.`
      };
    }

    const list = matches.map(d => d.name).join(', ');
    const message = language === 'en'
      ? `The following devices are ${isOnQuery ? 'on' : 'off'}: ${list}.`
      : `Los siguientes dispositivos están ${isOnQuery ? 'encendidos' : 'apagados'}: ${list}.`;

    return {
      type: 'answer',
      message
    };
  }

  private async findMatchingDevices(prompt: string): Promise<any[]> {
    const normalized = prompt.toLowerCase();
    const devices = await this.deviceRepository.findAll();
    return devices.filter(d => {
      const name = d.name.toLowerCase();
      // Basic match logic mirrored from IntentInterpreterService
      if (normalized.includes('sala') && !name.includes('sala')) return false;
      if (normalized.includes('cocina') && !name.includes('cocina')) return false;
      if (normalized.includes('cuarto') && !name.includes('cuarto')) return false;
      if (normalized.includes('escritorio') && !name.includes('escritorio')) return false;
      
      return name.includes('luz') || name.includes('lámpara') || name.includes('foco');
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
