import { IntentInterpreterService } from './IntentInterpreterService';
import { AssistantConfirmationPolicy } from './AssistantConfirmationPolicy';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { FailureInsightService } from '../../devices/application/FailureInsightService';

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
    private readonly intentInterpreter: IntentInterpreterService,
    private readonly confirmationPolicy: AssistantConfirmationPolicy,
    private readonly sceneExecutionService: SceneExecutionService,
    private readonly deviceCommandDispatcher: DeviceCommandDispatcherPort,
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository
  ) {}

  public async converse(request: AssistantConverseRequest, language: string = 'es'): Promise<AssistantConversationResponse> {
    // A) Selected Option Flow
    if (request.selectedOptionId && request.pendingAction) {
      return this.handleSelection(request);
    }

    const prompt = request.prompt.toLowerCase().trim();

    // B) State Queries
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
    const preview = await this.confirmationPolicy.evaluate(intent);
    if (preview.requiresConfirmation && request.confirmed !== true) {
      return {
        type: 'error',
        message: language === 'en'
          ? "I need confirmation to perform that action."
          : "Necesito confirmación para realizar esa acción."
      };
    }

    // E) Execution
    const correlationId = `assistant:chat:${Date.now()}`;
    if (intent.type === 'scene') {
      const scene = await this.sceneRepository.findSceneById(intent.target);
      if (!scene) return { type: 'error', message: "Scene not found." };
      
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
            message: result.actions[0]?.userMessage || result.actions[0]?.error || "Execution failed.",
            execution: result
          };
        }
        return {
          type: 'execution',
          message: language === 'en' ? "Action completed." : "Acción completada.",
          execution: result
        };
      } catch (error: any) {
        return {
          type: 'error',
          message: error.message || "Unknown error during execution."
        };
      }
    }

    return { type: 'error', message: "Unknown intent type." };
  }

  private async handleSelection(request: AssistantConverseRequest): Promise<AssistantConversationResponse> {
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
        message: "Escena ejecutada.",
        execution: result
      };
    }

    if (request.pendingAction?.command) {
      const result = await this.executeSingleCommand(request.selectedOptionId!, request.pendingAction.command, request.pendingAction.originalPrompt, correlationId);
      return {
        type: 'execution',
        message: result.status === 'success' ? "Acción completada." : "La ejecución falló.",
        execution: result
      };
    }

    return { type: 'error', message: "Invalid selection or pending action." };
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
    const isOnQuery = prompt.includes('encendido') || prompt.includes('encendidas') || prompt.includes(' on');
    
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
    const transientScene = {
      id: `assistant-chat-transient-${Date.now()}`,
      homeId: 'system',
      roomId: null,
      name: `Assistant Chat: ${prompt}`,
      actions: [{
        deviceId: deviceId,
        command: { name: command, params: {} }
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await this.sceneExecutionService.execute(transientScene as any, {
      sourceType: 'manual',
      sourceId: 'assistant',
      correlationId
    });
  }
}
