import { IntentInterpreterService } from '../application/IntentInterpreterService';
import { AssistantMultiCommandParser } from '../application/AssistantMultiCommandParser';
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
      new AssistantMultiCommandParser(mockDeviceRepo, mockRoomRepo),
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
    expect(mockLlmInterpreter.interpret).toHaveBeenCalledWith('test', undefined);
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
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockRoomRepo, new AssistantMultiCommandParser(mockDeviceRepo, mockRoomRepo), mockLlmInterpreter, mockMemoryService);

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
    const localService = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockRoomRepo, new AssistantMultiCommandParser(mockDeviceRepo, mockRoomRepo), mockLlmInterpreter, mockMemoryService);

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
  describe('home-scoped deterministic resolution', () => {
    it('does not fall back to global devices when an authorized user has no homes', async () => {
      const roomRepository = { findAll: jest.fn().mockResolvedValue([]) };
      const homeRepository = { findHomesByUserId: jest.fn().mockResolvedValue([]) };
      const scopedService = new IntentInterpreterService(
        mockDeviceRepo,
        mockSceneRepo,
        roomRepository as never,
        new AssistantMultiCommandParser(mockDeviceRepo, roomRepository as never),
        mockLlmInterpreter,
        undefined,
        homeRepository as never,
      );

      const intent = await scopedService.interpret('prende luz sala', 'user-without-home');

      expect(intent).toMatchObject({ type: 'unknown', reason: 'Device not found' });
      expect(mockDeviceRepo.findAll).not.toHaveBeenCalled();
      expect(mockDeviceRepo.findAllByHomeId).not.toHaveBeenCalled();
    });

    it('resolves scenes and devices only from the homes authorized to the caller', async () => {
      const roomRepository = { findAll: jest.fn().mockResolvedValue([]) };
      const homeRepository = { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-authorized' }]) };
      const authorizedDevice = {
        id: 'authorized-light', homeId: 'home-authorized', roomId: null, externalId: 'ha:light.authorized',
        name: 'Luz Autorizada', type: 'light', vendor: 'HA', status: 'ASSIGNED' as const,
        integrationSource: 'ha', invertState: false, lastKnownState: null, entityVersion: 1,
        createdAt: '', updatedAt: '',
      };
      const authorizedScene = { id: 'scene-authorized', name: 'Apaga todo', homeId: 'home-authorized', roomId: null, actions: [], createdAt: '', updatedAt: '' };
      mockDeviceRepo.findAllByHomeId.mockResolvedValue([authorizedDevice]);
      mockSceneRepo.findScenesByHomeId.mockResolvedValue([authorizedScene]);
      const scopedService = new IntentInterpreterService(
        mockDeviceRepo,
        mockSceneRepo,
        roomRepository as never,
        new AssistantMultiCommandParser(mockDeviceRepo, roomRepository as never),
        mockLlmInterpreter,
        undefined,
        homeRepository as never,
      );

      const command = await scopedService.interpret('prende luz sala', 'authorized-user');
      const scene = await scopedService.interpret('apaga todo', 'authorized-user');

      expect(command).toMatchObject({ type: 'command', deviceId: 'authorized-light', command: 'turn_on' });
      expect(scene).toMatchObject({ type: 'scene', target: 'scene-authorized' });
      expect(mockDeviceRepo.findAll).not.toHaveBeenCalled();
      expect(mockSceneRepo.findAll).not.toHaveBeenCalled();
    });
  });
  describe('deterministic support intents and ambiguity', () => {
    it('recognizes explainability and retry prompts without invoking the LLM', async () => {
      const explain = await service.interpret('¿Qué pasó con la luz?');
      const retry = await service.interpret('prueba otra vez');

      expect(explain).toMatchObject({ type: 'explain', prompt: '¿Qué pasó con la luz?' });
      expect(retry).toMatchObject({ type: 'retry', prompt: 'prueba otra vez' });
      expect(mockLlmInterpreter.interpret).not.toHaveBeenCalled();
    });

    it('keeps contradictory all-device and light commands explicit instead of guessing', async () => {
      mockSceneRepo.findAll.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([]);

      const all = await (service as unknown as { interpretDeterministic(prompt: string): Promise<Intent> }).interpretDeterministic('apaga y enciende todo');
      const light = await (service as unknown as { interpretDeterministic(prompt: string): Promise<Intent> }).interpretDeterministic('apaga y enciende la luz');

      expect(all).toMatchObject({ type: 'unknown', reason: 'Ambiguous command intent.' });
      expect(light).toMatchObject({ type: 'unknown', reason: 'Ambiguous command intent.' });
    });
  });
});
