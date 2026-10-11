import type { PlannerPromptMode } from './shadowTypes';

export const SHADOW_TIMEOUT_MS = 1_500;
export const SHADOW_MAX_TOKENS = 48;

export interface PlannerShadowConfig {
  force: boolean;
  isShadowEnabled: boolean;
  sampleRate: number;
  promptMode: PlannerPromptMode;
  shadowTimeoutMs: number;
  executionTimeoutMs: number;
  shadowModel: string | undefined;
  /** Resolved model for logging: shadow override → OLLAMA_MODEL env → 'phi3' fallback */
  resolvedModelName: string;
}

/** Lee la configuración de Planner V2 en sombra desde variables de entorno. */
export function readPlannerShadowConfig(env: NodeJS.ProcessEnv = process.env): PlannerShadowConfig {
  const flag = env.ASSISTANT_PLANNER_V2_SHADOW === 'true';
  const isDev = env.NODE_ENV !== 'production';
  const force = env.ASSISTANT_PLANNER_V2_SHADOW_FORCE === 'true';

  const configuredSampleRate = Number(env.ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE ?? '0.1');
  const sampleRate = Number.isFinite(configuredSampleRate) && configuredSampleRate >= 0 && configuredSampleRate <= 1
    ? configuredSampleRate
    : 0.1;
  const ultraLightEnabled = env.ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT !== 'false'; // Default: true
  const lightEnabled = env.ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT === 'true'; // Fallback

  // Resolve model name: specific override → OLLAMA_MODEL env → hardcoded fallback
  const modelOverride = env.ASSISTANT_PLANNER_V2_SHADOW_MODEL;

  return {
    force,
    isShadowEnabled: flag && (isDev || force),
    sampleRate,
    promptMode: ultraLightEnabled ? 'ultra_light' : (lightEnabled ? 'light' : 'full'),
    shadowTimeoutMs: SHADOW_TIMEOUT_MS,
    executionTimeoutMs: parseInt(env.ASSISTANT_PLANNER_V2_EXECUTION_TIMEOUT_MS || '3500', 10),
    shadowModel: modelOverride || undefined,
    resolvedModelName: modelOverride || env.OLLAMA_MODEL || 'phi3',
  };
}
