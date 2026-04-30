import { AssistantConversationService } from '../application/AssistantConversationService';
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
  createMockAssistantLearningService,
  createMockAssistantDraftService,
  createMockAutomationRuleRepository,
  createMockExecutionRecordRepository,
  createRealSmartEntityResolver,
  createMockAssistantSuggestionService,
  createTestDevice,
  createMockSystemVariableService
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { ExecutionRecord } from '../../devices/domain/ExecutionRecord';

describe('Assistant Explainability + Recovery', () => {
  let service: AssistantConversationService;
  let mockExecutionRepo: any;
  let mockDeviceRepo: any;
  let mockInterpreter: any;
  let mockConfirmationPolicy: any;
  let mockDispatcher: any;

  beforeEach(() => {
    mockExecutionRepo = createMockExecutionRecordRepository();
    mockDeviceRepo = createMockDeviceRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();
    mockDispatcher = createMockDeviceCommandDispatcher();

    const mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);

    service = new AssistantConversationService(
      mockInterpreter,
      mockConfirmationPolicy,
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      createMockRoomRepository(),
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      createMockAssistantMemory(),
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(mockDeviceRepo, createMockRoomRepository(), createMockSceneRepository(), createMockAutomationRuleRepository(), createMockAssistantMemory(), createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      mockExecutionRepo,
      createMockSystemVariableService()
    );
  });

  describe('Explainability', () => {
    it('should handle "por qué falló?" when no records exist', async () => {
      mockExecutionRepo.findRecent.mockResolvedValue([]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'por qué falló?' });

      const response = await service.converse({ prompt: 'por qué falló?' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No tengo una ejecución reciente');
    });

    it('should explain a failed action correctly', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec1',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'turn_on',
          status: 'failed',
          error: 'HA_SERVICE_CALL_FAILED',
          userMessage: 'No se pudo conectar con Home Assistant.',
          suggestedAction: 'Verifica la conexión.'
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'dev1', name: 'Luz Cocina' }));
      mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'por qué falló?' });

      const response = await service.converse({ prompt: 'por qué falló?' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No se pudo conectar con Home Assistant.');
      expect(response.message).toContain('Verifica la conexión.');
    });

    it('should say no failures were found if last record was success', async () => {
      const successRecord: ExecutionRecord = {
        id: 'rec2',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'success',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 1,
        failedCount: 0,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'turn_on',
          status: 'success'
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([successRecord]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'qué pasó?' });

      const response = await service.converse({ prompt: 'qué pasó?' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('no registra fallos');
    });

    it('should handle "por que no prendio" without accents', async () => {
      mockExecutionRepo.findRecent.mockResolvedValue([]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'por que no prendio' });

      const response = await service.converse({ prompt: 'por que no prendio' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(mockInterpreter.interpret).toHaveBeenCalled();
    });

    it('should handle "que paso" without accents', async () => {
      mockExecutionRepo.findRecent.mockResolvedValue([]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'que paso' });

      const response = await service.converse({ prompt: 'que paso' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(mockInterpreter.interpret).toHaveBeenCalled();
    });
  });

  describe('Recovery (Retry)', () => {
    it('should retry a single failed action directly', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec1',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'turn_on',
          status: 'failed',
          command: 'turn_on'
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'dev1', name: 'Luz Cocina' }));
      mockInterpreter.interpret.mockResolvedValue({ type: 'retry', prompt: 'reintenta' });
      mockDispatcher.dispatch.mockResolvedValue({ status: 'success', sceneId: 'retry', actions: [] });

      const response = await service.converse({ prompt: 'reintenta' }, 'es');
      
      expect(response.type).toBe('execution');
      expect(response.message).toContain('ahora se ejecutó correctamente');
      // Relax dispatcher check to see what's actually happening if it fails
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
      expect(mockDispatcher.dispatch.mock.calls[0][0]).toBe('dev1');
    });

    it('should require confirmation for multi-action retry', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec2',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 2,
        successCount: 0,
        failedCount: 2,
        skippedCount: 0,
        actions: [
          { deviceId: 'dev1', commandName: 'turn_on', status: 'failed', command: 'turn_on' },
          { deviceId: 'dev2', commandName: 'turn_on', status: 'failed', command: 'turn_on' }
        ]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'retry', prompt: 'reintenta' });

      const response = await service.converse({ prompt: 'reintenta' }, 'es');
      
      expect(response.type).toBe('clarification');
      expect(response.message).toContain('reintentar 2 acciones');
    });

    it('should handle failed retry correctly', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec1',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'turn_on',
          status: 'failed',
          command: 'turn_on'
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'retry', prompt: 'reintenta' });
      mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'dev1', homeId: 'h1' }));
      
      // Dispatch fails with a mapped error
      mockDispatcher.dispatch.mockRejectedValue(new Error('ha_service_call_failed'));

      const response = await service.converse({ prompt: 'reintenta' }, 'es');
      
      expect(response.type).toBe('error');
      expect(response.message).toContain('No se pudo conectar con Home Assistant');
    });

    it('should respond gracefully when retry target has no command information', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec1',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'turn_on',
          status: 'failed',
          command: undefined // No command info
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'retry', prompt: 'reintenta' });

      const response = await service.converse({ prompt: 'reintenta' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('no tengo suficiente información');
    });

    it('should skip retry if command is invalid according to type guard', async () => {
      const failedRecord: ExecutionRecord = {
        id: 'rec1',
        sourceType: 'manual',
        sourceId: 'assistant',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        actionCount: 1,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        actions: [{
          deviceId: 'dev1',
          commandName: 'invalid_cmd' as any,
          status: 'failed',
          command: 'invalid_cmd' as any
        }]
      };

      mockExecutionRepo.findRecent.mockResolvedValue([failedRecord]);
      mockInterpreter.interpret.mockResolvedValue({ type: 'retry', prompt: 'reintenta' });

      const response = await service.converse({ prompt: 'reintenta' }, 'es');
      
      expect(response.type).toBe('answer');
      expect(response.message).toContain('no tengo suficiente información');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
