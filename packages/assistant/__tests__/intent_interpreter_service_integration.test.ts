import { IntentInterpreterService } from '../application/IntentInterpreterService';
import { Intent } from '../application/ports/IntentInterpreterPort';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';
import { createMockDeviceRepository, createMockSceneRepository, createMockLlmIntentInterpreter, createMockAssistantMemory } from './test_helpers';

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

    const mockRoomRepo = {
      saveRoom: jest.fn(),
      findRoomsByHomeId: jest.fn(),
      findRoomById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([])
    } as any;

    service = new IntentInterpreterService(
      mockDeviceRepo,
      mockSceneRepo,
      mockRoomRepo,
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
    const mockMemoryService = createMockAssistantMemory({
      getLastDeviceUsed: jest.fn().mockResolvedValue('device-123')
    });
    
    // Inject mock memory service for this specific test
    const mockRoomRepo = { findAll: jest.fn().mockResolvedValue([]) } as any;
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockRoomRepo, mockLlmInterpreter, mockMemoryService);

    const intent = await localService.interpret('apágala');

    expect(intent.type).toBe('command');
    if (intent.type === 'command') {
      expect(intent.deviceId).toBe('device-123');
      expect(intent.command).toBe('turn_off');
    }
  });

  it('should return unknown for pronoun command if there is no recent device context', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    const mockMemoryService = createMockAssistantMemory({
      getLastDeviceUsed: jest.fn().mockResolvedValue(null)
    });
    
    const mockRoomRepo = { findAll: jest.fn().mockResolvedValue([]) } as any;
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockRoomRepo, mockLlmInterpreter, mockMemoryService);

    const intent = await localService.interpret('préndelo');

    expect(intent.type).toBe('unknown');
    if (intent.type === 'unknown') {
      expect(intent.reason).toBe('Missing recent device context to resolve pronoun.');
    }
  });

  describe('Bug Fix: "seccion" containing "on"', () => {
    beforeEach(() => {
      mockDeviceRepo.findAll.mockResolvedValue([{
        id: 'dev-escritorio', name: 'Luz Escritorio', homeId: 'h1', roomId: 'r1', type: 'light', vendor: '', status: 'ASSIGNED', integrationSource: 'ha', externalId: 'ha:light.escritorio', invertState: false, lastKnownState: null, capabilities: [], entityVersion: 1, createdAt: '', updatedAt: ''
      }]);
    });

    it('should correctly interpret "apagar luz seccion escritorio" as turn_off', async () => {
      const intent = await service.interpret('apagar luz seccion escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_off');
        expect(intent.deviceId).toBe('dev-escritorio');
      }
    });

    it('should correctly interpret "apaga luz seccion escritorio" as turn_off', async () => {
      const intent = await service.interpret('apaga luz seccion escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_off');
        expect(intent.deviceId).toBe('dev-escritorio');
      }
    });

    it('should correctly interpret "prende luz seccion escritorio" as turn_on', async () => {
      const intent = await service.interpret('prende luz seccion escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
        expect(intent.deviceId).toBe('dev-escritorio');
      }
    });

    it('should correctly interpret "turn on luz seccion escritorio" as turn_on', async () => {
      const intent = await service.interpret('turn on luz seccion escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
        expect(intent.deviceId).toBe('dev-escritorio');
      }
    });

    it('should correctly interpret "turn off luz seccion escritorio" as turn_off', async () => {
      const intent = await service.interpret('turn off luz seccion escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_off');
        expect(intent.deviceId).toBe('dev-escritorio');
      }
    });

    it('should not trigger "on" for "seccion" alone', async () => {
      const intent = await service.interpret('seccion');
      expect(intent.type).toBe('unknown');
    });
  });

  describe('Spanish Command Normalization', () => {
    beforeEach(() => {
      mockDeviceRepo.findAll.mockResolvedValue([{
        id: 'dev-escritorio', name: 'Luz Escritorio', homeId: 'h1', roomId: 'r1', type: 'light', vendor: '', status: 'ASSIGNED', integrationSource: 'ha', externalId: 'ha:light.escritorio', invertState: false, lastKnownState: null, capabilities: [], entityVersion: 1, createdAt: '', updatedAt: ''
      }]);
    });

    it('should interpret "enciendeme la luz escritorio" as turn_on', async () => {
      const intent = await service.interpret('enciendeme la luz escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
      }
    });

    it('should interpret "apagame la luz escritorio" as turn_off', async () => {
      const intent = await service.interpret('apagame la luz escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_off');
      }
    });

    it('should interpret "mijin enciendeme la luz" as turn_on', async () => {
      const intent = await service.interpret('mijin enciendeme la luz');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
      }
    });

    it('should interpret "encendeme la luz" as turn_on', async () => {
      const intent = await service.interpret('encendeme la luz');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
      }
    });

    it('should interpret "prendelo la luz escritorio" as turn_on', async () => {
      const intent = await service.interpret('prendelo la luz escritorio');
      expect(intent.type).toBe('command');
      if (intent.type === 'command') {
        expect(intent.command).toBe('turn_on');
      }
    });
  });

  describe('LLM Intent Interpreter Prompt Verification', () => {
    it('should include instructions for Spanish/English and typo tolerance in prompt', async () => {
      process.env.OLLAMA_ENABLED = 'true';
      const mockOllama = { generateJson: jest.fn().mockResolvedValue({ type: 'unknown' }) };
      const mockContext = { build: jest.fn().mockResolvedValue('{}') };
      const interpreter = new (require('../application/LlmIntentInterpreter').LlmIntentInterpreter)(mockOllama, mockContext, mockDeviceRepo, mockSceneRepo);
      
      await interpreter.interpret('test prompt');
      
      const sentPrompt = mockOllama.generateJson.mock.calls[0][0];
      expect(sentPrompt).toContain('Spanish, English, or mixed');
      expect(sentPrompt).toContain('Tolerate minor typos');
      expect(sentPrompt).toContain('NEVER invent or hallucinate IDs');
    });
  });
});
