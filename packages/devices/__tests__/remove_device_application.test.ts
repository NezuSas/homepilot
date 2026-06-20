import { removeDeviceUseCase } from '../application/removeDeviceUseCase';
import { DeviceInUseError, DeviceNotFoundError } from '../application/errors';
import { Device } from '../domain/types';
import { SceneRepository } from '../domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../domain/repositories/AutomationRuleRepository';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';

const device: Device = {
  id: 'device-1',
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: 'ha:cover.master',
  name: 'Cortina Master',
  type: 'cover',
  semanticType: 'cover',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: { state: 'open' },
  entityVersion: 1,
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
};

const createSceneRepository = (scenes: Awaited<ReturnType<SceneRepository['findAll']>>): SceneRepository => ({
  findSceneById: jest.fn(),
  findScenesByHomeId: jest.fn(),
  findAll: jest.fn().mockResolvedValue(scenes),
  saveScene: jest.fn(),
  deleteScene: jest.fn(),
});

const createAutomationRepository = (
  rules: Awaited<ReturnType<AutomationRuleRepository['findAll']>>,
): AutomationRuleRepository => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByTriggerDevice: jest.fn(),
  findByHomeId: jest.fn(),
  findAll: jest.fn().mockResolvedValue(rules),
  delete: jest.fn(),
});

describe('removeDeviceUseCase', () => {
  it('removes an unreferenced local device', async () => {
    const deviceRepository = new InMemoryDeviceRepository();
    await deviceRepository.saveDevice(device);

    await removeDeviceUseCase(device.id, {
      deviceRepository,
      sceneRepository: createSceneRepository([]),
      automationRuleRepository: createAutomationRepository([]),
    });

    await expect(deviceRepository.findDeviceById(device.id)).resolves.toBeNull();
  });

  it('rejects removal when a scene references the device', async () => {
    const deviceRepository = new InMemoryDeviceRepository();
    await deviceRepository.saveDevice(device);

    await expect(removeDeviceUseCase(device.id, {
      deviceRepository,
      sceneRepository: createSceneRepository([{
        id: 'scene-1',
        homeId: device.homeId,
        roomId: null,
        name: 'Noche',
        actions: [{ deviceId: device.id, command: 'close' }],
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      }]),
      automationRuleRepository: createAutomationRepository([]),
    })).rejects.toBeInstanceOf(DeviceInUseError);
  });

  it('rejects removal for nested triggers and delayed actions', async () => {
    const deviceRepository = new InMemoryDeviceRepository();
    await deviceRepository.saveDevice(device);
    const ruleBase = {
      homeId: device.homeId,
      userId: 'user-1',
      enabled: true,
    };

    const triggerRule = {
      ...ruleBase,
      id: 'rule-trigger',
      name: 'Trigger compuesto',
      trigger: {
        type: 'compound' as const,
        operator: 'NOT' as const,
        conditions: [{
          type: 'device_state_changed' as const,
          deviceId: device.id,
          stateKey: 'state',
          expectedValue: 'open',
        }],
      },
      action: { type: 'execute_scene' as const, sceneId: 'scene-1' },
    };
    const delayedActionRule = {
      ...ruleBase,
      id: 'rule-action',
      name: 'Acción diferida',
      trigger: {
        type: 'time' as const,
        timeLocal: '22:00',
        timezone: 'America/Guayaquil',
        timeUTC: '03:00',
      },
      action: {
        type: 'delay' as const,
        delaySeconds: 5,
        then: { type: 'device_command' as const, targetDeviceId: device.id, command: 'close' as const },
      },
    };

    await expect(removeDeviceUseCase(device.id, {
      deviceRepository,
      sceneRepository: createSceneRepository([]),
      automationRuleRepository: createAutomationRepository([triggerRule, delayedActionRule]),
    })).rejects.toBeInstanceOf(DeviceInUseError);
  });

  it('rejects an unknown device', async () => {
    await expect(removeDeviceUseCase('missing', {
      deviceRepository: new InMemoryDeviceRepository(),
      sceneRepository: createSceneRepository([]),
      automationRuleRepository: createAutomationRepository([]),
    })).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});
