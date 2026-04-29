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

  it('should execute shadow path if enabled', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith('enciende la luz', 'user-1');
    expect(validator.validate).toHaveBeenCalled();
    expect(resolver.resolve).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PLANNER_V2_SHADOW]'));
    
    consoleSpy.mockRestore();
  });

  it('should handle LLM failure silently', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockResolvedValue(null);
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"v2_plan":null'));
    
    consoleSpy.mockRestore();
  });

  it('should handle validator error and log it', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    validator.validate.mockReturnValue('Invalid schema');
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('enciende la luz', 'user-1', 'es', { type: 'answer', message: 'ok' });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"v2_validation":"Invalid schema"'));
    expect(resolver.resolve).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should run shadow for deterministic paths (greeting) when enabled', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    await shadowService.runShadow('hola', 'user-1', 'es', { type: 'answer', message: 'Hola, ¿cómo puedo ayudarte?' });
    
    expect(llmInterpreter.interpretV2).toHaveBeenCalledWith('hola', 'user-1');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PLANNER_V2_SHADOW]'));
    
    consoleSpy.mockRestore();
  });

  it('should not affect V1 response if shadow path fails', async () => {
    process.env.ASSISTANT_PLANNER_V2_SHADOW = 'true';
    llmInterpreter.interpretV2.mockRejectedValue(new Error('LLM Crash'));
    shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, validator, resolver);
    
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // This call should not throw
    await expect(shadowService.runShadow('luz', 'u1', 'es', { type: 'answer', message: 'ok' }))
      .resolves.not.toThrow();
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[PLANNER_V2_SHADOW] Execution error: LLM Crash'));
    
    consoleWarnSpy.mockRestore();
  });
});
