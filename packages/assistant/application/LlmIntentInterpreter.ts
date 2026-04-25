import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { isValidCommand, DeviceCommandV1 } from '../../devices/domain/commands';
import { LlmIntentInterpreterPort } from './ports/LlmIntentInterpreterPort';
import { OllamaClientPort } from './ports/OllamaClientPort';
import { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';
import { Intent } from './ports/IntentInterpreterPort';

interface LlmOutput {
  type: 'scene' | 'command' | 'unknown';
  sceneId?: string;
  deviceId?: string;
  command?: string;
  params?: Record<string, unknown>;
  reason?: string;
}

/**
 * LlmIntentInterpreter
 * 
 * Uses an LLM (via Ollama) to interpret natural language prompts.
 * Validates the LLM output against the system state before returning an Intent.
 */
export class LlmIntentInterpreter implements LlmIntentInterpreterPort {
  constructor(
    private readonly ollamaClient: OllamaClientPort,
    private readonly contextBuilder: AssistantContextBuilderPort,
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository
  ) {}

  /**
   * Interprets the prompt using Ollama.
   * Returns null if the LLM fails, times out, or produces an invalid proposal, 
   * signaling that the system should fall back to deterministic parsing.
   */
  public async interpret(prompt: string): Promise<Intent | null> {
    const context = await this.contextBuilder.build();
    
    const systemPrompt = `You are HomePilot AI Assistant, a flexible and smart controller for a smart home.
Interpret the user's natural language command into a structured JSON intent.
ONLY return a JSON object. NO conversation, NO markdown blocks, NO explanations.

Context of available entities:
${context}

Instructions:
- Understand commands in Spanish, English, or mixed (Spanglish).
- Tolerate minor typos and variations in natural language.
- Compare the user's text against the names of devices and scenes using semantic similarity.
- If the user uses pronouns like 'it', 'that', 'them', infer the target device or scene from recentActions.
- Map the intent based on keywords:
  - "apagar", "turn off", "off", "quitar" -> turn_off
  - "prende", "enciende", "turn on", "on", "activar" -> turn_on
- If a device is mentioned by an approximate name, pick the most likely existing deviceId from the context.
- NEVER invent or hallucinate IDs. Only use IDs provided in the context.
- If the intent is ambiguous or no reasonable match is found, use type "unknown".

Required Output Format:
{
  "type": "scene" | "command" | "unknown",
  "sceneId": "string (if type is scene)",
  "deviceId": "string (if type is command)",
  "command": "turn_on" | "turn_off" | "toggle" | "open" | "close" | "stop" | "set_position" (if type is command),
  "params": {},
  "reason": "string (if type is unknown)"
}

User command: "${prompt.replace(/"/g, '\"')}"`;

    try {
      const response = await this.ollamaClient.generateJson(systemPrompt);
      return await this.validateAndMap(response, prompt);
    } catch (error: unknown) {
      // We log errors but return null to trigger deterministic fallback
      console.warn('[LlmIntentInterpreter] LLM failed or timed out:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async validateAndMap(output: unknown, prompt: string): Promise<Intent | null> {
    if (!output || typeof output !== 'object') {
      return null;
    }

    const typedOutput = output as LlmOutput;

    if (typedOutput.type === 'scene') {
      if (!typedOutput.sceneId) return null;
      const scene = await this.sceneRepository.findSceneById(typedOutput.sceneId);
      if (!scene) return null;
      
      return { 
        type: 'scene', 
        target: scene.id, 
        prompt 
      };
    }

    if (typedOutput.type === 'command') {
      if (!typedOutput.deviceId || !typedOutput.command) return null;
      if (!isValidCommand(typedOutput.command)) return null;
      
      const device = await this.deviceRepository.findDeviceById(typedOutput.deviceId);
      if (!device) return null;

      // Validate params: must be an object if present
      const params = (typedOutput.params && typeof typedOutput.params === 'object' && !Array.isArray(typedOutput.params)) 
        ? typedOutput.params 
        : {};

      return {
        type: 'command',
        deviceId: device.id,
        command: typedOutput.command as DeviceCommandV1,
        params: params as Record<string, unknown>,
        prompt
      };
    }

    if (typedOutput.type === 'unknown') {
      return { 
        type: 'unknown', 
        prompt, 
        reason: typedOutput.reason || 'LLM could not interpret the command' 
      };
    }

    return null;
  }
}
