import { AssistantPlannerV2ShadowService } from '../application/AssistantPlannerV2ShadowService';
import { 
  createMockDeviceRepository, 
  createMockRoomRepository, 
  createMockSceneRepository, 
  createMockAssistantMemory,
  createTestDevice
} from './test_helpers';

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
    process.env.NODE_ENV = 'development'; // Default for tests

    llmInterpreter = {
      interpretV2: jest.fn().mockResolvedValue({ 
        type: 'plan', 
        plan_confidence: 0.9,
        actions: [{ 
          type: 'set_state',
          target: { type: 'device', name: 'luz' }, 
          command: 'turn_on',
          confidence: 0.9
        }],
        user_feedback_draft: 'Encendiendo luz'
      })
    };
    validator = {
      validate: jest.fn().mockReturnValue(null)
    };
    resolver = {
      resolve: jest.fn().mockResolvedValue({ type: 'single', deviceId: 'dev-1' })
    };
  });

  it('should do nothing if shadow mode is disabled', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'false';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();
  });

  it('should execute shadow path if enabled in development', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.NODE_ENV = 'development';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PLANNER_V2_SHADOW_V2]'));
    
    consoleSpy.mockRestore();
  });

  it('should not execute in production unless forced', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.NODE_ENV = 'production';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_FORCE = 'false';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();

    // Now force it
    process.env.ASSISTANT_PLANNER_V2_SHADOW_FORCE = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should respect sampling rate', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE = '0'; // 0% sampling
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    expect(llmInterpreter.interpretV2).not.toHaveBeenCalled();
  });

  it('should handle LLM failure silently but log it in V2 structure', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockResolvedValue(null);
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"error":{"message":"LLM returned null or empty plan","type":"llm_failure"}'));
    
    consoleSpy.mockRestore();
  });

  it('should warn on slow execution', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Just a bit of delay
      return { type: 'plan', actions: [] };
    });
    
    // We mock Date.now to simulate 1600ms
    const now = Date.now();
    const dateSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(now)         // t0
      .mockReturnValueOnce(now + 1600); // end of shadow

    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();

    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Slow execution: 1600ms'));
    
    dateSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
