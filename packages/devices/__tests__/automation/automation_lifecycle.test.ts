import { enableAutomationRuleUseCase } from '../../application/usecases/automation/EnableAutomationRuleUseCase';
import { disableAutomationRuleUseCase } from '../../application/usecases/automation/DisableAutomationRuleUseCase';
import { updateAutomationRuleUseCase } from '../../application/usecases/automation/UpdateAutomationRuleUseCase';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { AutomationRuleNotFoundError, DeviceNotFoundError, ForbiddenOwnershipError } from '../../application/errors';
import { InvalidAutomationRuleError, AutomationLoopError } from '../../domain/errors';

describe('Automation Lifecycle: Application Use Cases', () => {
  let ruleRepo: InMemoryAutomationRuleRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let topologyMock: jest.Mocked<TopologyReferencePort>;

  // Regla base persistida antes de cada test que la necesite
  const baseRuleData = {
    id: 'rule-1',
    homeId: 'home-1',
    userId: 'user-owner',
    name: 'Base Rule',
    enabled: true,
    trigger: { type: 'device_state_changed' as const, deviceId: 'd1', stateKey: 'contact', expectedValue: 'open' },
    action: { type: 'device_command' as const, targetDeviceId: 'd2', command: 'turn_on' as any }
  };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    deviceRepo = new InMemoryDeviceRepository();

    topologyMock = {
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
  });

  const setupBaseRule = () => ruleRepo.save(baseRuleData);

  const setupDevices = async () => {
    await deviceRepo.saveDevice({
      id: 'd1', homeId: 'home-1', roomId: 'r1', externalId: 'e1',
      name: 'Sensor', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'd2', homeId: 'home-1', roomId: 'r1', externalId: 'e2',
      name: 'Light', type: 'light', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
  };

  const enableDeps = () => ({
    automationRuleRepository: ruleRepo,
    topologyReferencePort: topologyMock
  });

  const updateDeps = () => ({
    automationRuleRepository: ruleRepo,
    deviceRepository: deviceRepo,
    topologyReferencePort: topologyMock
  });

  // ---------------------------------------------------------------------------
  // Enable
  // ---------------------------------------------------------------------------

  describe('enableAutomationRuleUseCase', () => {
    it('habilita una regla deshabilitada y la retorna con enabled:true (AC2)', async () => {
      await ruleRepo.save({ ...baseRuleData, enabled: false });
      const result = await enableAutomationRuleUseCase('rule-1', 'user-owner', enableDeps());
      expect(result.enabled).toBe(true);
      const persisted = await ruleRepo.findById('rule-1');
      expect(persisted?.enabled).toBe(true);
    });

    it('es idempotente: habilitar una regla ya habilitada retorna éxito sin error (AC3)', async () => {
      await setupBaseRule(); // enabled: true
      await expect(enableAutomationRuleUseCase('rule-1', 'user-owner', enableDeps())).resolves.toMatchObject({ enabled: true });
    });

    it('lanza AutomationRuleNotFoundError si la regla no existe (AC8)', async () => {
      await expect(enableAutomationRuleUseCase('ghost', 'user-owner', enableDeps())).rejects.toThrow(AutomationRuleNotFoundError);
    });

    it('propaga ForbiddenOwnershipError si el usuario no tiene ownership (AC7)', async () => {
      await setupBaseRule();
      topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
      await expect(enableAutomationRuleUseCase('rule-1', 'intruder', enableDeps())).rejects.toThrow(ForbiddenOwnershipError);
    });
  });

  // ---------------------------------------------------------------------------
  // Disable
  // ---------------------------------------------------------------------------

  describe('disableAutomationRuleUseCase', () => {
    it('deshabilita una regla habilitada y la retorna con enabled:false (AC1)', async () => {
      await setupBaseRule(); // enabled: true
      const result = await disableAutomationRuleUseCase('rule-1', 'user-owner', enableDeps());
      expect(result.enabled).toBe(false);
      const persisted = await ruleRepo.findById('rule-1');
      expect(persisted?.enabled).toBe(false);
    });

    it('es idempotente: deshabilitar una regla ya deshabilitada retorna éxito sin error (AC3)', async () => {
      await ruleRepo.save({ ...baseRuleData, enabled: false });
      await expect(disableAutomationRuleUseCase('rule-1', 'user-owner', enableDeps())).resolves.toMatchObject({ enabled: false });
    });

    it('lanza AutomationRuleNotFoundError si la regla no existe (AC8)', async () => {
      await expect(disableAutomationRuleUseCase('ghost', 'user-owner', enableDeps())).rejects.toThrow(AutomationRuleNotFoundError);
    });

    it('propaga ForbiddenOwnershipError si el usuario no tiene ownership (AC7)', async () => {
      await setupBaseRule();
      topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
      await expect(disableAutomationRuleUseCase('rule-1', 'intruder', enableDeps())).rejects.toThrow(ForbiddenOwnershipError);
    });
  });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  describe('updateAutomationRuleUseCase', () => {
    it('actualiza solo el nombre y preserva trigger y action originales (AC4)', async () => {
      await setupBaseRule();
      const result = await updateAutomationRuleUseCase('rule-1', 'user-owner', { name: 'Nuevo Nombre' }, updateDeps());
      expect(result.name).toBe('Nuevo Nombre');
      expect((result.trigger as any).deviceId).toBe('d1');
      expect((result.action as any).targetDeviceId).toBe('d2');
    });

    it('lanza AutomationRuleNotFoundError si la regla no existe (AC8)', async () => {
      await expect(
        updateAutomationRuleUseCase('ghost', 'user-owner', { name: 'X' }, updateDeps())
      ).rejects.toThrow(AutomationRuleNotFoundError);
    });

    it('propaga ForbiddenOwnershipError si el usuario no tiene ownership (AC7)', async () => {
      await setupBaseRule();
      topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
      await expect(
        updateAutomationRuleUseCase('rule-1', 'intruder', { name: 'X' }, updateDeps())
      ).rejects.toThrow(ForbiddenOwnershipError);
    });

    it('lanza DeviceNotFoundError si el nuevo targetDeviceId no existe (AC5 prerequisito)', async () => {
      await setupBaseRule();
      await setupDevices();
      await expect(
        updateAutomationRuleUseCase('rule-1', 'user-owner', {
          action: { type: 'device_command', targetDeviceId: 'ghost-device', command: 'turn_on' }
        }, updateDeps())
      ).rejects.toThrow(DeviceNotFoundError);
    });

    it('lanza InvalidAutomationRuleError si el nuevo trigger.deviceId pertenece a otro hogar (AC5)', async () => {
      await setupBaseRule();
      await setupDevices();
      // Sensor de otro hogar
      await deviceRepo.saveDevice({
        id: 'd-otro', homeId: 'home-2', roomId: 'r2', externalId: 'e3',
        name: 'Alien', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
        lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
      });
      await expect(
        updateAutomationRuleUseCase('rule-1', 'user-owner', {
          trigger: { type: 'device_state_changed', deviceId: 'd-otro', stateKey: 'k', expectedValue: 'v' }
        }, updateDeps())
      ).rejects.toThrow(InvalidAutomationRuleError);
    });

    it('lanza AutomationLoopError si el update resulta en trigger.deviceId === action.targetDeviceId (AC6)', async () => {
      await setupBaseRule();
      await setupDevices();
      await expect(
        updateAutomationRuleUseCase('rule-1', 'user-owner', {
          trigger: { type: 'device_state_changed', deviceId: 'd2', stateKey: 'power', expectedValue: 'off' }
        }, updateDeps())
      ).rejects.toThrow(AutomationLoopError);
    });
  });
});
