import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { isValidCommand, DeviceCommandV1 } from '../../devices/domain/commands';
import { LlmIntentInterpreterPort } from './ports/LlmIntentInterpreterPort';
import { OllamaClientPort } from './ports/OllamaClientPort';
import { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';
import { Intent } from './ports/IntentInterpreterPort';
import { PLANNER_V2_SCHEMA, AssistantPlanV2 } from './ports/AssistantPlannerV2';

interface LlmOutput {
  type: 'scene' | 'command' | 'unknown';
  sceneId?: string;
  deviceId?: string;
  command?: string;
  params?: Record<string, unknown>;
  reason?: string;
}

export interface PlannerV2InterpretResult {
  plan: AssistantPlanV2 | null;
  metadata: { promptChars: number; devicesCount: number };
  error?: Error;
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

  /**
   * [EXPERIMENTAL] Interprets the prompt using Planner V2 schema.
   * Never throws. Always returns metadata even if the LLM fails or times out.
   * Metadata (promptChars, devicesCount) is captured before the Ollama call so it
   * survives timeouts and other LLM failures.
   */
  public async interpretV2(
    prompt: string,
    userId: string,
    options?: { timeoutMs?: number; model?: string; promptMode?: 'full' | 'light' | 'ultra_light' }
  ): Promise<PlannerV2InterpretResult> {
    // Step 1: Build home map and prompt BEFORE the LLM call.
    let homeMap = '';
    let devicesCount = 0;
    let systemPrompt = '';

    try {
      if (options?.promptMode === 'ultra_light') {
        const result = await this.contextBuilder.buildUltraLightLlmHomeMap(prompt, userId);
        homeMap = result.text;
        devicesCount = result.devicesCount;
        systemPrompt = this.buildUltraLightPlannerV2Prompt(prompt, homeMap);
      } else {
        const isLight = options?.promptMode === 'light';
        homeMap = isLight
          ? await this.contextBuilder.buildLightLlmHomeMap(userId)
          : await this.contextBuilder.buildLlmHomeMap(userId);

        const parsedHomeMap = JSON.parse(homeMap) as { devices?: unknown[] };
        devicesCount = Array.isArray(parsedHomeMap.devices) ? parsedHomeMap.devices.length : 0;
        systemPrompt = await this.buildPlannerV2PromptFromMap(prompt, homeMap, isLight);
      }
    } catch (buildError: unknown) {
      return {
        plan: null,
        metadata: { promptChars: 0, devicesCount: 0 },
        error: buildError instanceof Error ? buildError : new Error(String(buildError))
      };
    }

    const metadata = { promptChars: systemPrompt.length, devicesCount };

    // Step 2: Call LLM with pre-built prompt. Metadata is already captured above.
    try {
      const response = await this.ollamaClient.generateJson(systemPrompt, {
        timeoutMs: options?.timeoutMs,
        model: options?.model
      });

      if (!response || typeof response !== 'object') {
        return { plan: null, metadata, error: new Error('LLM returned empty or invalid object') };
      }

      return { plan: response as AssistantPlanV2, metadata };
    } catch (llmError: unknown) {
      return {
        plan: null,
        metadata,
        error: llmError instanceof Error ? llmError : new Error(String(llmError))
      };
    }
  }

  private async buildPlannerV2PromptFromMap(prompt: string, homeMap: string, light: boolean = false): Promise<string> {
    const basePrompt = `You are HomePilot AI Assistant, a semantic planner for a smart home.
Interpret the user's natural language command into a structured JSON plan.
ONLY return a JSON object following the schema provided. NO conversation, NO markdown.

Context of home map:
${homeMap}

Strict Schema:
${JSON.stringify(PLANNER_V2_SCHEMA, null, 2)}`;

    const instructions = light 
      ? `\nInstructions:
- Use natural names. No IDs.
- Ambiguity? Use "clarification_needed".`
      : `\nInstructions:
- Use natural names from the context to identify targets.
- Never output real IDs or UUIDs.
- If the user uses pronouns or references context, use the context_hint field with values like: 
  'turn_it_on', 'turn_it_off', 'first_option', 'above_area', 'it', 'them'.
- If ambiguity exists, use type "clarification_needed".`;

    return `${basePrompt}${instructions}\n\nUser command: "${prompt.replace(/"/g, '\"')}"`;
  }

  private buildUltraLightPlannerV2Prompt(prompt: string, homeMapText: string): string {
    return `You are HomePilot AI Assistant.
Output ONLY JSON matching this exact structure:
{"type":"plan","plan_confidence":0.9,"actions":[{"type":"set_state","target":{"type":"device","name":"natural name"},"command":"turn_on|turn_off|toggle|open|close|stop|set_position|set_brightness|query","params":{},"confidence":0.9}],"user_feedback_draft":"short text"}
NO markdown. NO explanations.

Home:
${homeMapText}

User command: "${prompt.replace(/"/g, '\"')}"`;
  }

  /**
   * [EXPERIMENTAL] Builds a Planner V2 prompt for the LLM.
   * This is currently isolated and not used in the active conversation flow.
   */
  public async buildPlannerV2Prompt(prompt: string, userId: string, promptMode: 'full' | 'light' | 'ultra_light' = 'full'): Promise<string> {
    if (promptMode === 'ultra_light') {
      const result = await this.contextBuilder.buildUltraLightLlmHomeMap(prompt, userId);
      return this.buildUltraLightPlannerV2Prompt(prompt, result.text);
    }
    
    const isLight = promptMode === 'light';
    const homeMap = isLight 
      ? await this.contextBuilder.buildLightLlmHomeMap(userId)
      : await this.contextBuilder.buildLlmHomeMap(userId);
    
    return this.buildPlannerV2PromptFromMap(prompt, homeMap, isLight);
  }
}
