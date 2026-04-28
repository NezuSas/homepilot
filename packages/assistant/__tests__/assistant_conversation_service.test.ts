import { AssistantConversationService } from '../application/AssistantConversationService';
import type { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import type { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import type { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import type { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import type { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { 
  createMockDeviceRepository, 
  createMockSceneRepository, 
  createMockRoomRepository,
  createMockIntentInterpreterService, 
  createMockAssistantConfirmationPolicy, 
  createMockDeviceCommandDispatcher,
  createMockAssistantSmallTalk,
  createMockAssistantMemory,
  createMockFollowUpResolver,
  createTestDevice
} from './test_helpers';
import type { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import type { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import type { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';

describe('AssistantConversationService', () => {
  let service: AssistantConversationService;
  let mockInterpreter: jest.Mocked<IntentInterpreterPort>;
  let mockConfirmationPolicy: jest.Mocked<AssistantConfirmationPolicyPort>;
  let mockSceneExecution: SceneExecutionService;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockRoomRepo: jest.Mocked<RoomRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;
  let mockSmallTalk: jest.Mocked<AssistantSmallTalkPort>;
  let mockMemory: jest.Mocked<AssistantMemoryPort>;
  let mockFollowUp: jest.Mocked<FollowUpResolverPort>;

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockExecutionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findRecent: jest.fn(),
      findBySource: jest.fn(),
      findById: jest.fn()
    };
    
    // We use the real SceneExecutionService with a mock dispatcher and repo
    mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);
    
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);
    mockSceneRepo = createMockSceneRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();
    mockSmallTalk = createMockAssistantSmallTalk();
    mockSmallTalk.handle.mockResolvedValue({
      type: 'answer',
      message: 'Friendly fallback'
    });
    mockMemory = createMockAssistantMemory();
    mockFollowUp = createMockFollowUpResolver();

    service = new AssistantConversationService(
      mockInterpreter,
      mockConfirmationPolicy,
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      mockSmallTalk,
      mockMemory,
      mockFollowUp,
      { createSceneDraft: jest.fn(), createAutomationDraft: jest.fn(), activateDraft: jest.fn() } as any,
      { findAll: jest.fn(), findById: jest.fn(), save: jest.fn(), delete: jest.fn() } as any
    );
  });

  describe('Greetings', () => {
    it('should respond to "Hola" with a friendly answer in Spanish', async () => {
      const response = await service.converse({ prompt: 'Hola' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('ayudarte con tu casa');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "hello" with a friendly answer in English', async () => {
      const response = await service.converse({ prompt: 'hello' }, 'en');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('ready to help with your home');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "buenas noches" correctly', async () => {
      const response = await service.converse({ prompt: 'buenas noches' }, 'es');
      expect(response.type).toBe('answer');
    });

    it('should respond to "hey" correctly in English', async () => {
      const response = await service.converse({ prompt: 'hey' }, 'en');
      expect(response.type).toBe('answer');
    });

    it('should respond to "quien te creo" mentioning NEZU S.A.S.', async () => {
      const response = await service.converse({ prompt: 'quien te creo' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('NEZU S.A.S.');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "who created you" in English mentioning NEZU S.A.S.', async () => {
      const response = await service.converse({ prompt: 'who created you' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('NEZU S.A.S.');
    });

    it('should not trigger for words containing greetings (e.g. "holas" or "hellooo")', async () => {
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'holas', reason: 'not_found' });
      const response = await service.converse({ prompt: 'holas' }, 'es');
      expect(response.type).toBe('answer'); // Now returns user-friendly fallback instead of error
      expect(response.message).toContain('Friendly fallback');
    });

    it('should respond to "gracias" correctly', async () => {
      const response = await service.converse({ prompt: 'gracias' }, 'es');
      expect(response.type).toBe('answer');
    });
  });

  describe('Presentation and Name', () => {
    it('should respond to "quién eres" with a professional introduction', async () => {
      const response = await service.converse({ prompt: 'quién eres' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Soy el asistente local');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "Cómo te llamas?" correctly', async () => {
      const response = await service.converse({ prompt: 'Cómo te llamas?' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Me llamo HomePilot');
    });

    it('should respond to "what is your name" in English', async () => {
      const response = await service.converse({ prompt: 'what is your name' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('My name is HomePilot');
    });

    it('should respond to "qué puedes hacer" correctly', async () => {
      const response = await service.converse({ prompt: 'qué puedes hacer' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Puedo ayudarte a saber qué está encendido');
    });

    it('should respond to "what can you do" in English', async () => {
      const response = await service.converse({ prompt: 'what can you do' }, 'en');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('I can help you see what is on');
    });
  });

  describe('Date and Time', () => {
    it('should respond to "qué hora es" with current time', async () => {
      const response = await service.converse({ prompt: 'qué hora es' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toMatch(/Son las \d{2}:\d{2}/);
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "qué fecha es hoy" with current date', async () => {
      const response = await service.converse({ prompt: 'qué fecha es hoy' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Hoy es');
    });

    it('should respond to "what time is it" in English', async () => {
      const response = await service.converse({ prompt: 'what time is it' }, 'en');
      
      expect(response.type).toBe('answer');
      expect(response.message).toMatch(/It is \d{2}:\d{2}/);
    });
  });

  describe('State Queries', () => {
    it('should handle "qué está encendido" query with bulleted list', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: true } }),
        createTestDevice({ id: '3', name: 'Ventilador', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({ prompt: 'qué está encendido' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Tienes 2 dispositivos encendidas:');
      expect(response.message).toContain('• Luz Sala');
      expect(response.message).toContain('• Luz Cocina');
    });

    it('should handle "Que luces estan encendidas?" correctly filtering by type', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Enchufe', type: 'switch', lastKnownState: { on: true } })
      ]);

      const response = await service.converse({ prompt: 'Que luces estan encendidas?' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Tienes 1 luces encendidas');
      expect(response.message).toContain('• Luz Sala');
      expect(response.message).not.toContain('• Enchufe');
    });

    it('should handle compound "on and off" queries', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas y cuales apagadas' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Encendidas:\n• Luz Sala');
      expect(response.message).toContain('Apagadas:\n• Luz Cocina');
      expect(response.message).toContain('estado de la casa:');
    });

    it('should filter by room name if found in repository', async () => {
      const room1Id = 'room-1';
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        { id: room1Id, name: 'Cuarto Master', homeId: 'h1', createdAt: '', updatedAt: '', entityVersion: 1 }
      ]);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Master', roomId: room1Id, lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Sala', roomId: 'other', lastKnownState: { on: true } })
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas en cuarto master' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('en Cuarto Master');
      expect(response.message).toContain('• Luz Master');
      expect(response.message).not.toContain('• Luz Sala');
    });

    it('should filter by room token as fallback if room not in repo', async () => {
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Cocina', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Sala', lastKnownState: { on: true } })
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas en la cocina' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('• Luz Cocina');
      expect(response.message).not.toContain('• Luz Sala');
    });

    it('should return amigable message if no devices in room', async () => {
       mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        { id: 'r1', name: 'Baño', homeId: 'h1', createdAt: '', updatedAt: '', entityVersion: 1 }
      ]);
      mockDeviceRepo.findAll.mockResolvedValue([]);

      const response = await service.converse({ prompt: 'que hay encendido en el baño' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No encontré dispositivos en Baño');
    });

    it('should not trigger dispatcher or scene execution for status queries', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } })
      ]);

      await service.converse({ prompt: 'que esta encendido' }, 'es');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('User Friendly Small Talk and Unknowns', () => {
    it('should correctly handle wellness queries with typos', async () => {
      const typoPrompts = ["comoe stas", "como stas", "q tal", "how are u"];
      
      for (const prompt of typoPrompts) {
        const response = await service.converse({ prompt, userName: 'User' }, 'es');
        expect(response.type).toBe('answer');
        expect(response.message).toContain('Estoy funcionando correctamente');
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockExecutionRepo.save).not.toHaveBeenCalled();
      }
    });

    it('should route non-control questions directly to SmallTalkService without IntentInterpreter', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Tu casa es muy interesante.'
      });
      
      const prompts = [
        "dime algo interesante sobre mi casa",
        "qué opinas de la automatización",
        "cuéntame algo divertido"
      ];

      for (const prompt of prompts) {
        jest.clearAllMocks();
        const response = await service.converse({ prompt, userName: 'User' }, 'es');
        expect(response.type).toBe('answer');
        expect(mockSmallTalk.handle).toHaveBeenCalledWith(prompt, 'es', 'User', 'system');
        expect(mockInterpreter.interpret).not.toHaveBeenCalled();
      }
    });

    it('should route likely home control prompts to IntentInterpreter', async () => {
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'enciende luz sala', reason: 'mock' });
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Fallback fallback'
      });
      
      await service.converse({ prompt: 'enciende luz sala' }, 'es');
      expect(mockInterpreter.interpret).toHaveBeenCalled();
      expect(mockSmallTalk.handle).toHaveBeenCalled(); // Because intent was unknown
    });

    it('should delegate unknown conversational prompts to SmallTalkService', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Ollama says hello'
      });
      
      const response = await service.converse({ prompt: 'Tell me a joke' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toBe('Ollama says hello');
      expect(mockSmallTalk.handle).toHaveBeenCalledWith('Tell me a joke', 'en', null, 'system');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('should respond with a friendly fallback when SmallTalkService returns it', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'No estoy seguro de lo que quieres hacer'
      });
      
      const response = await service.converse({ prompt: 'blah blah' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No estoy seguro');
    });
  });
});
