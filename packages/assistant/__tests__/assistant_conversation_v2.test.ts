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
  createMockExecutionRecordRepository,
  createTestDevice
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';

describe('AssistantConversationService V2 (Memory & Context)', () => {
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
    mockExecutionRepo = createMockExecutionRecordRepository();
    mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);
    jest.spyOn(mockSceneExecution, 'execute').mockResolvedValue({
      sceneId: 'transient',
      status: 'success',
      actions: []
    });
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockSceneRepo = createMockSceneRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();
    mockConfirmationPolicy.evaluate.mockResolvedValue({ 
      requiresConfirmation: false,
      prompt: '',
      intentType: 'command',
      summary: ''
    });
    mockSmallTalk = createMockAssistantSmallTalk();
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
      mockFollowUp
    );
  });

  it('should resolve "esas" using memory and then interpret the resolved prompt', async () => {
    const memoryState = {
      lastQueryType: 'state_devices',
      entities: [
        { id: '1', name: 'Luz Sala', type: 'light', roomId: 'r1' },
        { id: '2', name: 'Luz Cocina', type: 'light', roomId: 'r1' }
      ],
      timestamp: new Date().toISOString()
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);
    
    // Setup follow-up resolver to simulate "esas" -> "cuéntame sobre Luz Sala, Luz Cocina"
    mockFollowUp.resolve.mockReturnValue({
      resolvedPrompt: 'qué son Luz Sala, Luz Cocina',
      handled: false
    });

    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true }, roomId: 'r1' }),
      createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: true }, roomId: 'r1' })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
      { 
        id: 'r1', 
        name: 'Sala', 
        homeId: 'h1', 
        entityVersion: 1, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString() 
      }
    ]);

    const response = await service.converse({ prompt: 'y esas?', userId: 'user-1' }, 'es');

    expect(mockFollowUp.resolve).toHaveBeenCalledWith(
      'y esas?', 
      expect.anything(), 
      'es', 
      {}
    );
    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Sala (Sala)');
    expect(response.message).toContain('Luz Cocina (Sala)');
  });

  it('should save execution to memory for future follow-ups', async () => {
    mockInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: '1',
      command: 'turn_on',
      prompt: 'enciende la luz'
    });
    
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: '1', name: 'Luz Sala', roomId: 'r1' }));
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: '1', name: 'Luz Sala', roomId: 'r1' })]);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    mockMemory.saveShortTermMemory.mockClear();
    
    await service.converse({ prompt: 'enciende la luz', userId: 'user-1' }, 'es');

    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      lastQueryType: 'execution',
      entities: [expect.objectContaining({ id: '1', name: 'Luz Sala' })]
    }));
  });
});
