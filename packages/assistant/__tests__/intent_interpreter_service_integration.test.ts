import { IntentInterpreterService, Intent } from '../application/IntentInterpreterService';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';
import { createMockDeviceRepository, createMockSceneRepository, createMockLlmIntentInterpreter } from './test_helpers';

describe('IntentInterpreterService Integration', () => {
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockLlmInterpreter: jest.Mocked<LlmIntentInterpreterPort>;
  let service: IntentInterpreterService;

  beforeEach(() => {
    process.env.OLLAMA_ENABLED = 'false';
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneRepo = createMockSceneRepository();
    mockLlmInterpreter = createMockLlmIntentInterpreter();

    service = new IntentInterpreterService(
      mockDeviceRepo,
      mockSceneRepo,
      mockLlmInterpreter
    );
  });

  afterEach(() => {
    delete process.env.OLLAMA_ENABLED;
  });

  it('should use deterministic logic when LLM is disabled', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    mockSceneRepo.findAll.mockResolvedValue([]);
    
    const intent = await service.interpret('apaga todo');
    
    expect(mockLlmInterpreter.interpret).not.toHaveBeenCalled();
    expect(intent.type).toBe('unknown');
  });

  it('should use LLM when enabled and it returns a valid intent', async () => {
    process.env.OLLAMA_ENABLED = 'true';
    const expectedIntent: Intent = { type: 'scene', target: 's1', prompt: 'test' };
    mockLlmInterpreter.interpret.mockResolvedValue(expectedIntent);

    const intent = await service.interpret('test');

    expect(intent).toEqual(expectedIntent);
    expect(mockLlmInterpreter.interpret).toHaveBeenCalledWith('test');
  });

  it('should fallback to deterministic if LLM returns unknown', async () => {
    process.env.OLLAMA_ENABLED = 'true';
    mockLlmInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'test', reason: 'unknown' });
    mockSceneRepo.findAll.mockResolvedValue([]);

    const intent = await service.interpret('apaga todo');

    expect(intent.type).toBe('unknown');
  });

  it('should fallback to deterministic if LLM fails', async () => {
    process.env.OLLAMA_ENABLED = 'true';
    mockLlmInterpreter.interpret.mockRejectedValue(new Error('LLM Error'));
    mockSceneRepo.findAll.mockResolvedValue([]);

    const intent = await service.interpret('apaga todo');

    expect(intent.type).toBe('unknown');
  });
});
