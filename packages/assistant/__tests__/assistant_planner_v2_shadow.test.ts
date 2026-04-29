import { AssistantPlannerV2ShadowService } from '../application/AssistantPlannerV2ShadowService';
import {
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAssistantMemory,
  createTestDevice
} from './test_helpers';

const makePlan = () => ({
  plan: {
    type: 'plan',
    plan_confidence: 0.9,
    actions: [{
      type: 'set_state',
      target: { type: 'device', name: 'luz' },
      command: 'turn_on',
      confidence: 0.9
    }],
    user_feedback_draft: 'Encendiendo luz'
  },
  metadata: { promptChars: 620, devicesCount: 8 }
});

describe('Assistant Planner V2 Shadow Mode', () => {
  let shadowService: AssistantPlannerV2ShadowService;
  let llmInterpreter: any;
  let validator: any;
  let resolver: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'development';
    process.env.OLLAMA_MODEL = 'phi3';
    delete process.env.ASSISTANT_PLANNER_V2_SHADOW_MODEL;
    delete process.env.ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT;

    llmInterpreter = {
      interpretV2: jest.fn().mockResolvedValue(makePlan())
    };
    validator = {
      validate: jest.fn().mockReturnValue(null)
    };
    resolver = {
      resolve: jest.fn().mockResolvedValue({ type: 'single', deviceId: 'dev-1' })
    };
  });

  // ─── Gating ──────────────────────────────────────────────────────────────

  it('should do nothing if shadow mode is disabled', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'false';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });

    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();
  });

  it('should not execute in production unless forced', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.NODE_ENV = 'production';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_FORCE = 'false';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();

    // Force flag enables it in production
    process.env.ASSISTANT_PLANNER_V2_SHADOW_FORCE = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should respect sampling rate of 0', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE = '0';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();
  });

  it('should skip execution for internal selection prompts', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('Selected: dev-1', 'u1', 'es', { type: 'answer', message: 'ok' });
    await shadowService.runShadow('Selection: room', 'u1', 'es', { type: 'answer', message: 'ok' });
    await shadowService.runShadow('', 'u1', 'es', { type: 'answer', message: 'ok' });
    await shadowService.runShadow('habla en ingles', 'u1', 'es', { type: 'answer', message: 'ok' });

    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();
    
    // Check skipped logs
    const skipLogs = spy.mock.calls
      .map(([arg]) => arg as string)
      .filter(s => s.includes('[PLANNER_V2_SHADOW_SKIPPED]'));
      
    expect(skipLogs).toHaveLength(4);
    expect(skipLogs[0]).toContain('"reason":"internal_selection"');
    expect(skipLogs[2]).toContain('"reason":"empty_prompt"');
    expect(skipLogs[3]).toContain('"reason":"language_override"');

    spy.mockRestore();
  });

  // ─── Metadata always populated ────────────────────────────────────────────

  it('should populate metadata in log when LLM succeeds', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));

    expect(shadowLog).toBeDefined();
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.metrics.prompt_chars).toBe(620);
    expect(parsed.metrics.home_map_devices_count).toBe(8);
    expect(parsed.error).toBeNull();

    spy.mockRestore();
  });

  it('should populate metadata when Ollama times out', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    // interpretV2 returns non-throwing timeout result with real metadata
    llmInterpreter.interpretV2.mockResolvedValue({
      plan: null,
      metadata: { promptChars: 542, devicesCount: 6 },
      error: new Error('Ollama request timed out after 8000ms')
    });
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));

    expect(shadowLog).toBeDefined();
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.metrics.prompt_chars).toBe(542);
    expect(parsed.metrics.home_map_devices_count).toBe(6);
    expect(parsed.error.type).toBe('timeout');

    spy.mockRestore();
  });

  // ─── Model resolution ─────────────────────────────────────────────────────

  it('should log resolved OLLAMA_MODEL when shadow model override is empty', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.OLLAMA_MODEL = 'phi3';
    // No ASSISTANT_PLANNER_V2_SHADOW_MODEL set
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.metrics.model).toBe('phi3');

    spy.mockRestore();
  });

  it('should honor shadow model override in logs', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_MODEL = 'tiny-llama';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith(
      'test', 'u1', expect.objectContaining({ model: 'tiny-llama' })
    );
    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.metrics.model).toBe('tiny-llama');

    spy.mockRestore();
  });

  // ─── Error categorization ─────────────────────────────────────────────────

  it('should categorize timeout errors as "timeout"', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockResolvedValue({
      plan: null,
      metadata: { promptChars: 400, devicesCount: 4 },
      error: new Error('Ollama request timed out after 12000ms')
    });
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.error.type).toBe('timeout');

    spy.mockRestore();
  });

  // ─── [PLANNER_V2_PROMPT_BUILT] log ────────────────────────────────────────

  it('should emit [PLANNER_V2_PROMPT_BUILT] with correct fields and no IDs', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    const promptLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_PROMPT_BUILT]'));

    expect(promptLog).toBeDefined();
    const parsed = JSON.parse(promptLog!.replace('[PLANNER_V2_PROMPT_BUILT] ', ''));
    expect(parsed.prompt_chars).toBe(620);
    expect(parsed.home_map_devices_count).toBe(8);
    expect(parsed.model).toBe('phi3');
    expect(parsed.timeout_ms).toBe(8000);
    expect(parsed.promptMode).toBe('ultra_light');

    // No IDs or HA entity IDs in the log
    expect(promptLog).not.toMatch(/light\.\w+/);
    expect(promptLog).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    spy.mockRestore();
  });

  // ─── Slow execution warning ───────────────────────────────────────────────

  it('should warn on slow execution', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockResolvedValue({
      plan: { type: 'plan', actions: [] },
      metadata: { promptChars: 0, devicesCount: 0 }
    });

    const now = Date.now();
    const dateSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 1600);

    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();

    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Slow execution: 1600ms'));

    dateSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // ─── V1/V2 Comparison ─────────────────────────────────────────────────────

  it('should mark V2 as better candidate when V1 clarifies and V2 succeeds with high confidence', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    
    // Resolver mock must return a single target
    resolver.resolve.mockResolvedValue({ type: 'single', deviceId: 'dev-1' });

    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    // V1 response is 'clarification'
    await shadowService.runShadow('enciende luz', 'u1', 'es', { type: 'clarification', message: 'Cual luz?', clarification: { question: '?', options: [] } });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
      
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.comparison.likely_v2_better_candidate).toBe(true);
    expect(parsed.comparison.reason).toBe('v2_single_high_confidence_match');

    spy.mockRestore();
  });

  it('should NOT mark V2 as better candidate if V1 is not clarification', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    // V1 response is 'execution'
    await shadowService.runShadow('enciende luz', 'u1', 'es', { type: 'execution', message: 'Encendiendo' });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
      
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.comparison.likely_v2_better_candidate).toBe(false);
    expect(parsed.comparison.reason).toBe('v1_not_clarification');

    spy.mockRestore();
  });

  it('should NOT mark V2 as better candidate if V2 plan confidence is low', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    
    const lowConfPlan = makePlan();
    lowConfPlan.plan.plan_confidence = 0.5; // low confidence
    llmInterpreter.interpretV2.mockResolvedValue(lowConfPlan);

    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('enciende luz', 'u1', 'es', { type: 'clarification', message: 'Cual luz?', clarification: { question: '?', options: [] } });

    const shadowLog = spy.mock.calls
      .map(([arg]) => arg as string)
      .find(s => s.includes('[PLANNER_V2_SHADOW_V2]'));
      
    const parsed = JSON.parse(shadowLog!.replace('[PLANNER_V2_SHADOW_V2] ', ''));
    expect(parsed.comparison.likely_v2_better_candidate).toBe(false);
    expect(parsed.comparison.reason).toBe('v2_low_plan_confidence');

    spy.mockRestore();
  });

  // ─── Prompt mode default ──────────────────────────────────────────────────

  it('should use ultra_light prompt and 8s timeout by default', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith(
      'test', 'u1',
      expect.objectContaining({ promptMode: 'ultra_light', timeoutMs: 8000 })
    );
    spy.mockRestore();
  });
  
  it('should fall back to light prompt if ultra_light is disabled', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT = 'false';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);

    const spy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });

    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith(
      'test', 'u1',
      expect.objectContaining({ promptMode: 'light', timeoutMs: 8000 })
    );
    spy.mockRestore();
  });
});
