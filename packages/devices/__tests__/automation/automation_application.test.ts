import { createAutomationRuleUseCase } from '../../application/usecases/automation/CreateAutomationRuleUseCase';
import { listAutomationRulesUseCase } from '../../application/usecases/automation/ListAutomationRulesUseCase';
import { deleteAutomationRuleUseCase } from '../../application/usecases/automation/DeleteAutomationRuleUseCase';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { DeviceNotFoundError, ForbiddenOwnershipError } from '../../application/errors';
import { InvalidAutomationRuleError } from '../../domain/errors';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { DeviceCommandV1 } from '../../domain/commands';

describe('Automation Application: CRUD Use Cases', () => {
  let ruleRepo: InMemoryAutomationRuleRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let topologyMock: jest.Mocked<TopologyReferencePort>;

  const idGen = { generate: () => 'rule-id-123' };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    deviceRepo = new InMemoryDeviceRepository();
    
    topologyMock = {
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
  });

  const setupDevices = async () => {
    await deviceRepo.saveDevice({
      id: 'd1', homeId: 'home-1', roomId: 'r1', externalId: 'ext1',
      name: 'Sensor', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'd2', homeId: 'home-1', roomId: 'r1', externalId: 'ext2',
      name: 'Light', type: 'light', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
  };

  describe('CreateAutomationRuleUseCase', () => {
    it('debe persistir la entidad si los dispositivos y el ownership son correctos', async () => {
      await setupDevices();

      const rule = await createAutomationRuleUseCase(
        {
          homeId: 'home-1',
          userId: 'user-1',
          name: 'Rule Alpha',
          trigger: { deviceId: 'd1', stateKey: 'presence', expectedValue: true },
          action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
        },
        {
          automationRuleRepository: ruleRepo,
          deviceRepository: deviceRepo,
          topologyReferencePort: topologyMock,
          idGenerator: idGen
        }
      );

      expect(rule.id).toBe('rule-id-123');
      const saved = await ruleRepo.findById('rule-id-123');
      expect(saved).toBeDefined();
      expect(topologyMock.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-1');
    });

    it('debe fallar si el dispositivo disparador no existe en el repositorio', async () => {
      await expect(createAutomationRuleUseCase(
        {
          homeId: 'home-1', userId: 'user-1', name: 'Error',
          trigger: { deviceId: 'non-existent', stateKey: 'k', expectedValue: 'v' },
          action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
        },
        { 
          automationRuleRepository: ruleRepo, 
          deviceRepository: deviceRepo, 
          topologyReferencePort: topologyMock, 
          idGenerator: idGen 
        }
      )).rejects.toThrow(DeviceNotFoundError);
    });

    it('debe fallar si existe inconsistencia de hogar entre dispositivos', async () => {
      await deviceRepo.saveDevice({
        id: 'd1', homeId: 'home-1', roomId: 'r1', externalId: 'ext1',
        name: 'S', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
        lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
      });
      await deviceRepo.saveDevice({
        id: 'd2', homeId: 'home-2', roomId: 'r2', externalId: 'ext2',
        name: 'L', type: 'light', vendor: 'v', status: 'ASSIGNED',
        lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
      });
      
      await expect(createAutomationRuleUseCase(
        {
          homeId: 'home-1', userId: 'user-1', name: 'Mismatch',
          trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: 'v' },
          action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
        },
        { 
          automationRuleRepository: ruleRepo, 
          deviceRepository: deviceRepo, 
          topologyReferencePort: topologyMock, 
          idGenerator: idGen 
        }
      )).rejects.toThrow(InvalidAutomationRuleError);
    });
    
    it('debe propagar ForbiddenOwnershipError si falla la validación de topología', async () => {
      await setupDevices();
      topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));

      await expect(createAutomationRuleUseCase(
        {
          homeId: 'home-1', userId: 'user-2', name: 'No Owner',
          trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: 'v' },
          action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
        },
        { 
          automationRuleRepository: ruleRepo, 
          deviceRepository: deviceRepo, 
          topologyReferencePort: topologyMock, 
          idGenerator: idGen 
        }
      )).rejects.toThrow(ForbiddenOwnershipError);
    });
  });

  describe('List y Delete', () => {
    it('listRules debe invocar el repositorio filtrando por homeId validado', async () => {
      await ruleRepo.save({
        id: 'r1', homeId: 'home-1', userId: 'u1', name: 'Rule 1', enabled: true,
        trigger: { deviceId: 'd1', stateKey: 's1', expectedValue: 'v1' },
        action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
      });

      const rules = await listAutomationRulesUseCase('home-1', 'user-1', {
        automationRuleRepository: ruleRepo,
        topologyReferencePort: topologyMock
      });

      expect(rules).toHaveLength(1);
      expect(topologyMock.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-1');
    });

    it('deleteRule debe realizar borrado físico tras validar el ownership', async () => {
      await ruleRepo.save({
        id: 'r1', homeId: 'home-1', userId: 'u1', name: 'Trash', enabled: true,
        trigger: { deviceId: 'd1', stateKey: 's1', expectedValue: 'v1' },
        action: { targetDeviceId: 'd2', command: 'turn_on' as DeviceCommandV1 }
      });

      await deleteAutomationRuleUseCase('r1', 'user-1', {
        automationRuleRepository: ruleRepo,
        topologyReferencePort: topologyMock
      });

      const found = await ruleRepo.findById('r1');
      expect(found).toBeNull();
      expect(topologyMock.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-1');
    });
  });
});
