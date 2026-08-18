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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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

  it('interpretV2 constrains decoding with the Planner V2 JSON Schema', async () => {
    mockContextBuilder.buildUltraLightLlmHomeMap = jest.fn().mockResolvedValue({ text: 'Devices:\n', devicesCount: 0 });
    mockOllama.generateJson.mockResolvedValue({ type: 'small_talk', plan_confidence: 1, actions: [], user_feedback_draft: '' });

    await interpreter.interpretV2('hola', 'u1', { promptMode: 'ultra_light' });

    expect(mockOllama.generateJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ format: expect.objectContaining({ type: 'object' }) })
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
  it.each([
    [null],
    ['not-an-object'],
    [{ type: 'scene' }],
    [{ type: 'command', deviceId: 'device-1' }],
    [{ type: 'command', command: 'turn_on' }],
    [{ type: 'unrecognized' }],
  ])('returns null for malformed or incomplete LLM output %p', async (output) => {
    mockOllama.generateJson.mockResolvedValue(output);

    await expect(interpreter.interpret('test')).resolves.toBeNull();
  });

  it('normalizes invalid command params and uses the default unknown reason', async () => {
    mockOllama.generateJson.mockResolvedValueOnce({ type: 'command', deviceId: 'd1', command: 'turn_off', params: ['invalid'] });
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'd1' }));
    await expect(interpreter.interpret('turn off')).resolves.toEqual(expect.objectContaining({ params: {} }));

    mockOllama.generateJson.mockResolvedValueOnce({ type: 'unknown' });
    await expect(interpreter.interpret('something')).resolves.toEqual(expect.objectContaining({
      reason: 'LLM could not interpret the command'
    }));
  });

  it('builds full and light Planner V2 maps, returns metadata on invalid LLM output, and contains context errors', async () => {
    mockContextBuilder.buildLlmHomeMap = jest.fn().mockResolvedValue(JSON.stringify({ devices: [{ id: 'd1' }] }));
    mockContextBuilder.buildLightLlmHomeMap = jest.fn().mockResolvedValue(JSON.stringify({ devices: [{ id: 'd1' }, { id: 'd2' }] }));
    mockOllama.generateJson.mockResolvedValueOnce(null).mockResolvedValueOnce({ actions: [] });

    const full = await interpreter.interpretV2('turn on', 'user-1');
    const light = await interpreter.interpretV2('turn on', 'user-1', { promptMode: 'light', timeoutMs: 200, model: 'tiny' });

    expect(full.plan).toBeNull();
    expect(full.error?.message).toBe('LLM returned empty or invalid object');
    expect(full.metadata.devicesCount).toBe(1);
    expect(light.plan).toEqual({ actions: [] });
    expect(light.metadata.devicesCount).toBe(2);
    expect(mockOllama.generateJson).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ timeoutMs: 200, model: 'tiny' }));

    mockContextBuilder.buildLlmHomeMap = jest.fn().mockRejectedValueOnce(new Error('context unavailable'));
    await expect(interpreter.interpretV2('turn on', 'user-1')).resolves.toEqual(expect.objectContaining({
      plan: null, metadata: { promptChars: 0, devicesCount: 0 }, error: expect.objectContaining({ message: 'context unavailable' })
    }));
  });

  it('preserves Planner V2 metadata when Ollama rejects', async () => {
    mockContextBuilder.buildLlmHomeMap = jest.fn().mockResolvedValue(JSON.stringify({ devices: [] }));
    mockOllama.generateJson.mockRejectedValue(new Error('timeout'));

    const result = await interpreter.interpretV2('turn on', 'user-1');

    expect(result.plan).toBeNull();
    expect(result.metadata.promptChars).toBeGreaterThan(0);
    expect(result.metadata.devicesCount).toBe(0);
    expect(result.error?.message).toBe('timeout');
  });
});
