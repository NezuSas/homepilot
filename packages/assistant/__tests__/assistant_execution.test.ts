import { IntentInterpreterService } from '../application/IntentInterpreterService';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { Scene } from '../../devices/domain/Scene';
import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';

describe('Assistant Execution Integration', () => {
  let interpreter: IntentInterpreterService;
  let sceneService: SceneExecutionService;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;

  const mockDevice = (fields: Partial<Device>): Device => ({
    id: 'dev-1',
    homeId: 'h1',
    roomId: null,
    externalId: 'ext-1',
    name: 'Device',
    type: 'light',
    vendor: 'v',
    status: 'ASSIGNED',
    integrationSource: 'ha',
    invertState: false,
    lastKnownState: null,
    capabilities: [],
    entityVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...fields
  });

  beforeEach(() => {
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined)
    };
    mockExecutionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findRecent: jest.fn(),
      findBySource: jest.fn(),
      findById: jest.fn()
    };
    mockDeviceRepo = {
      findAll: jest.fn(),
      findDeviceById: jest.fn(),
      saveDevice: jest.fn(),
      findInboxByHomeId: jest.fn(),
      findByExternalIdAndHomeId: jest.fn(),
      findByExternalId: jest.fn(),
      findAllOrderedByStatus: jest.fn(),
      findAllByHomeId: jest.fn(),
      findAllExternalIdsByPrefix: jest.fn()
    };
    mockSceneRepo = {
      findAll: jest.fn(),
      findSceneById: jest.fn(),
      findScenesByHomeId: jest.fn(),
      saveScene: jest.fn(),
      deleteScene: jest.fn()
    };

    const mockRoomRepo = { findAll: jest.fn().mockResolvedValue([]) } as any;
    interpreter = new IntentInterpreterService(mockDeviceRepo, mockSceneRepo, mockRoomRepo);
    sceneService = new SceneExecutionService(mockDispatcher, mockExecutionRepo);
  });

  describe('IntentInterpreterService', () => {
    it('should map "apaga todo" to scene if found in repo', async () => {
      mockSceneRepo.findAll.mockResolvedValue([{
        id: 'scene-123',
        name: 'Apaga todo el hogar',
        homeId: 'h1',
        roomId: null,
        actions: [],
        createdAt: '',
        updatedAt: ''
      }]);

      const intent = await interpreter.interpret('apaga todo');
      expect(intent).toEqual({ type: 'scene', target: 'scene-123', prompt: 'apaga todo' });
    });

    it('should return unknown if scene "apaga todo" not found', async () => {
      mockSceneRepo.findAll.mockResolvedValue([]);
      const intent = await interpreter.interpret('apaga todo');
      expect(intent.type).toBe('unknown');
      if (intent.type === 'unknown') {
        expect(intent.reason).toContain('No scene found');
      }
    });

    it('should map "prende luz sala" to command if device found', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        mockDevice({ id: 'dev-sala-1', name: 'Luz de la Sala' })
      ]);

      const intent = await interpreter.interpret('prende luz sala');
      expect(intent).toEqual({ 
        type: 'command', 
        deviceId: 'dev-sala-1', 
        command: 'turn_on', 
        prompt: 'prende luz sala' 
      });
    });

    it('should return unknown if device "luz sala" not found', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);
      const intent = await interpreter.interpret('prende luz sala');
      expect(intent.type).toBe('unknown');
      if (intent.type === 'unknown') {
        expect(intent.reason).toContain('Device not found');
      }
    });
  });

  describe('Assistant Execution Flow', () => {
    it('should execute a command by wrapping it in a transient scene', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        mockDevice({ id: 'dev-sala-1', name: 'Luz de la Sala' })
      ]);

      const intent = await interpreter.interpret('apaga luz sala');
      if (intent.type !== 'command') throw new Error('Expected command intent');

      const transientScene: Scene = {
        id: 'assistant-transient-test',
        homeId: 'system',
        roomId: null,
        name: `Assistant NL: ${intent.prompt}`,
        actions: [{
          deviceId: intent.deviceId,
          command: { name: intent.command as DeviceCommandV1, params: {} }
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionMode: 'parallel'
      };

      const result = await sceneService.execute(transientScene, {
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId: 'assistant:test-123'
      });

      expect(result.status).toBe('success');
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith('dev-sala-1', expect.objectContaining({ name: 'turn_off' }));
      
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        sourceType: 'manual',
        sourceId: 'assistant',
        correlationId: 'assistant:test-123'
      }));
    });
  });
});
