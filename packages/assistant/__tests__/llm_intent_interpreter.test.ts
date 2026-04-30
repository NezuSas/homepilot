import { LlmIntentInterpreter } from '../application/LlmIntentInterpreter';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { OllamaClientPort } from '../application/ports/OllamaClientPort';
import { AssistantContextBuilderPort } from '../application/ports/AssistantContextBuilderPort';
import { 
  createTestDevice, 
  createTestScene, 
  createMockDeviceRepository, 
  createMockSceneRepository,
  createMockOllamaClient,
  createMockAssistantContextBuilder
} from './test_helpers';

describe('LlmIntentInterpreter', () => {
  let mockOllama: jest.Mocked<OllamaClientPort>;
  let mockContextBuilder: jest.Mocked<AssistantContextBuilderPort>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let interpreter: LlmIntentInterpreter;

  beforeEach(() => {
    mockOllama = createMockOllamaClient();
    mockContextBuilder = createMockAssistantContextBuilder();
    mockContextBuilder.build.mockResolvedValue('{}');
    
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneRepo = createMockSceneRepository();

    interpreter = new LlmIntentInterpreter(
      mockOllama,
      mockContextBuilder,
      mockDeviceRepo,
      mockSceneRepo
    );
  });

  it('should return scene intent if valid', async () => {
    const testScene = createTestScene({ id: 's1', name: 'Scene 1' });
    mockOllama.generateJson.mockResolvedValue({ type: 'scene', sceneId: 's1' });
    mockSceneRepo.findSceneById.mockResolvedValue(testScene);

    const intent = await interpreter.interpret('activate scene 1');
    expect(intent).toEqual({ type: 'scene', target: 's1', prompt: 'activate scene 1' });
  });

  it('should return null if scene does not exist', async () => {
    mockOllama.generateJson.mockResolvedValue({ type: 'scene', sceneId: 'nonexistent' });
    mockSceneRepo.findSceneById.mockResolvedValue(null);

    const intent = await interpreter.interpret('test');
    expect(intent).toBeNull();
  });

  it('should return command intent if valid', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'Light 1' });
    mockOllama.generateJson.mockResolvedValue({ 
      type: 'command', 
      deviceId: 'd1', 
      command: 'turn_on',
      params: { brightness: 100 }
    });
    mockDeviceRepo.findDeviceById.mockResolvedValue(testDevice);

    const intent = await interpreter.interpret('turn on light');
    expect(intent).toEqual({ 
      type: 'command', 
      deviceId: 'd1', 
      command: 'turn_on', 
      params: { brightness: 100 },
      prompt: 'turn on light' 
    });
  });

  it('should return null if command is invalid', async () => {
    mockOllama.generateJson.mockResolvedValue({ 
      type: 'command', 
      deviceId: 'd1', 
      command: 'invalid_cmd' 
    });
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'd1' }));

    const intent = await interpreter.interpret('test');
    expect(intent).toBeNull();
  });

  it('should return unknown intent if LLM says unknown', async () => {
    mockOllama.generateJson.mockResolvedValue({ type: 'unknown', reason: 'I dont know' });
    const intent = await interpreter.interpret('who are you?');
    expect(intent).toEqual({ type: 'unknown', prompt: 'who are you?', reason: 'I dont know' });
  });

  it('should return null on LLM failure', async () => {
    mockOllama.generateJson.mockRejectedValue(new Error('timeout'));
    const intent = await interpreter.interpret('test');
    expect(intent).toBeNull();
  });

  describe('buildPlannerV2Prompt (ultra_light)', () => {
    it('should generate ultra_light prompt without enum pipe literals', async () => {
      mockContextBuilder.buildUltraLightLlmHomeMap = jest.fn().mockResolvedValue({ text: 'mockHomeMap', devicesCount: 10 });
      
      const prompt = await interpreter.buildPlannerV2Prompt('apaga la luz de cocina', 'u1', 'ultra_light');
      
      // Should not have the old pipe strings
      expect(prompt).not.toContain('set_state|query_status');
      expect(prompt).not.toContain('turn_on|turn_off');
      expect(prompt).not.toContain('device|room|category');
      
      // Should contain the instruction and concrete examples
      expect(prompt).toContain('Choose exactly one allowed value');
      expect(prompt).toContain('{"actions":[{"type":"set_state","target":{"type":"device","name":"Luz"},"command":"turn_off"}]}');
      expect(prompt).toContain('mockHomeMap');
    });
  });
});
