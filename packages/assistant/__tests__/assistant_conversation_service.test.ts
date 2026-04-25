import { AssistantConversationService } from '../application/AssistantConversationService';
import { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { 
  createMockDeviceRepository, 
  createMockSceneRepository, 
  createMockIntentInterpreterService, 
  createMockAssistantConfirmationPolicy, 
  createMockDeviceCommandDispatcher,
  createTestDevice
} from './test_helpers';

describe('AssistantConversationService', () => {
  let service: AssistantConversationService;
  let mockInterpreter: jest.Mocked<IntentInterpreterPort>;
  let mockConfirmationPolicy: jest.Mocked<AssistantConfirmationPolicyPort>;
  let mockSceneExecution: SceneExecutionService;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;

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
    mockSceneRepo = createMockSceneRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();

    service = new AssistantConversationService(
      mockInterpreter,
      mockConfirmationPolicy,
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockSceneRepo
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

    it('should not trigger for words containing greetings (e.g. "holas" or "hellooo")', async () => {
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'holas', reason: 'not_found' });
      const response = await service.converse({ prompt: 'holas' }, 'es');
      expect(response.type).toBe('error');
    });
  });

  describe('Presentation', () => {
    it('should respond to "quién eres" with a professional introduction', async () => {
      const response = await service.converse({ prompt: 'quién eres' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Soy HomePilot');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "qué puedes hacer" correctly', async () => {
      const response = await service.converse({ prompt: 'qué puedes hacer' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('asistente local');
    });

    it('should respond to "what can you do" in English', async () => {
      const response = await service.converse({ prompt: 'what can you do' }, 'en');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('I’m HomePilot');
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
    it('should handle "qué está encendido" query', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({ prompt: 'qué está encendido' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Luz Sala');
      expect(response.message).not.toContain('Luz Cocina');
    });
  });
});
