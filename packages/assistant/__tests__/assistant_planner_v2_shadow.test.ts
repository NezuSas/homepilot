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
        metadata: { promptChars: 100, devicesCount: 5 }
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
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"prompt_chars":100'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"home_map_devices_count":5'));
    
    consoleSpy.mockRestore();
  });

  it('should use default shadow settings (light prompt, 8s timeout)', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith(
      'test', 
      'u1', 
      expect.objectContaining({ 
        timeoutMs: 8000, 
        lightPrompt: true 
      })
    );
    infoSpy.mockRestore();
  });

  it('should honor shadow model override', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    process.env.ASSISTANT_PLANNER_V2_SHADOW_MODEL = 'tiny-llama';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith(
      'test', 
      'u1', 
      expect.objectContaining({ 
        model: 'tiny-llama' 
      })
    );
    infoSpy.mockRestore();
  });

  it('should categorize timeout errors correctly', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockRejectedValue(new Error('Ollama request timed out after 8000ms'));
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('test', 'u1', 'es', { type: 'answer', message: 'ok' });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"error":{"message":"Ollama request timed out after 8000ms","type":"timeout"}'));
    
    consoleSpy.mockRestore();
  });

  it('should warn on slow execution', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Just a bit of delay
      return { plan: { type: 'plan', actions: [] }, metadata: { promptChars: 0, devicesCount: 0 } };
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
