import { IntentInterpreterService, Intent } from '../application/IntentInterpreterService';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';
import { createMockDeviceRepository, createMockSceneRepository, createMockLlmIntentInterpreter, createMockAssistantMemoryService } from './test_helpers';

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
    // Setup deterministic parser to succeed
    mockSceneRepo.findAll.mockResolvedValue([{
      id: 'scene-all-off', name: 'Apagar todo', homeId: 'h1', roomId: 'r1', actions: [], createdAt: '', updatedAt: ''
    }]);

    const intent = await service.interpret('apaga todo');

    expect(intent.type).toBe('scene');
    if (intent.type === 'scene') {
      expect(intent.target).toBe('scene-all-off');
    }
  });

  it('should resolve pronoun command if there is a valid recent device context', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    const mockMemoryService = createMockAssistantMemoryService({
      getLastDeviceUsed: jest.fn().mockResolvedValue('device-123')
    });
    
    // Inject mock memory service for this specific test
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockLlmInterpreter, mockMemoryService);

    const intent = await localService.interpret('apágala');

    expect(intent.type).toBe('command');
    if (intent.type === 'command') {
      expect(intent.deviceId).toBe('device-123');
      expect(intent.command).toBe('turn_off');
    }
  });

  it('should return unknown for pronoun command if there is no recent device context', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    const mockMemoryService = createMockAssistantMemoryService({
      getLastDeviceUsed: jest.fn().mockResolvedValue(null)
    });
    
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockLlmInterpreter, mockMemoryService);

    const intent = await localService.interpret('préndelo');

    expect(intent.type).toBe('unknown');
    if (intent.type === 'unknown') {
      expect(intent.reason).toBe('Missing recent device context to resolve pronoun.');
    }
  });
});
