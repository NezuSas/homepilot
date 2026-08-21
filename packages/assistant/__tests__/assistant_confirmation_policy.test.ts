import { AssistantConfirmationPolicy } from '../application/AssistantConfirmationPolicy';
import { Intent } from '../application/ports/IntentInterpreterPort';
import { createMockDeviceRepository, createMockSceneRepository, createTestDevice, createTestScene } from './test_helpers';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';

describe('AssistantConfirmationPolicy', () => {
  let policy: AssistantConfirmationPolicy;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;

  beforeEach(() => {
    mockSceneRepo = createMockSceneRepository();
    mockDeviceRepo = createMockDeviceRepository();
    policy = new AssistantConfirmationPolicy(mockSceneRepo, mockDeviceRepo);
  });

  it('keeps unknown intents confirmation-free with localized feedback', async () => {
    const es = await policy.evaluate({ type: 'unknown', prompt: 'haz magia', reason: 'Not understood' });
    const en = await policy.evaluate({ type: 'unknown', prompt: 'do magic', reason: 'Not understood' }, 'en');

    expect(es).toEqual(expect.objectContaining({ requiresConfirmation: false, summary: 'No pude interpretar esa instrucción.' }));
    expect(en).toEqual(expect.objectContaining({ requiresConfirmation: false, summary: 'I could not interpret that instruction.' }));
  });

  it('executes an explicitly requested scene without confirmation', async () => {
    mockSceneRepo.findSceneById.mockResolvedValue(createTestScene({ name: 'Noche', actions: [{ deviceId: '1', command: 'turn_on' }] }));

    const result = await policy.evaluate({ type: 'scene', target: 'scene_1', prompt: 'activa modo noche' });

    expect(result).toEqual(expect.objectContaining({ requiresConfirmation: false, intentType: 'scene', targetName: 'Noche', estimatedActionCount: 1 }));
  });

  it.each([
    ['abre la cortina cuarto master', 'open'],
    ['cierra la cortina cuarto master', 'close'],
    ['apaga toda la casa', 'turn_off'],
    ['prende todas las luces', 'turn_on'],
  ] as const)('executes explicit domestic command %s without confirmation', async (prompt, command) => {
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ name: 'Cortina Cuarto Master' }));

    const result = await policy.evaluate({ type: 'command', deviceId: 'dev_1', command, prompt });

    expect(result).toEqual(expect.objectContaining({ requiresConfirmation: false, intentType: 'command', targetName: 'Cortina Cuarto Master' }));
  });

  it('executes explicitly requested multi-device commands without confirmation', async () => {
    const result = await policy.evaluate({
      type: 'multi_command',
      prompt: 'apaga sala y cocina',
      actions: [
        { deviceId: 'one', command: 'turn_off', targetName: 'Sala' },
        { deviceId: 'two', command: 'turn_off', targetName: 'Cocina' },
      ],
      requiresConfirmation: false,
    }, 'en');

    expect(result).toEqual(expect.objectContaining({ requiresConfirmation: false, intentType: 'multi_command', estimatedActionCount: 2 }));
  });

  it('preserves resolved target labels when a device or scene no longer exists', async () => {
    mockSceneRepo.findSceneById.mockResolvedValue(null);
    mockDeviceRepo.findDeviceById.mockResolvedValue(null);

    const scene = await policy.evaluate({ type: 'scene', target: 'missing', prompt: 'activa escena' });
    const command = await policy.evaluate({ type: 'command', deviceId: 'missing', command: 'turn_off', prompt: 'apaga luz' }, 'en');

    expect(scene).toEqual(expect.objectContaining({ targetName: 'Desconocido', requiresConfirmation: false }));
    expect(command).toEqual(expect.objectContaining({ targetName: 'Unknown', requiresConfirmation: false }));
  });

  it('keeps informational intents confirmation-free in both supported languages', async () => {
    const explain = await policy.evaluate({ type: 'explain', prompt: 'por que' });
    const retry = await policy.evaluate({ type: 'retry', prompt: 'intenta otra vez' }, 'en');
    const company = await policy.evaluate({ type: 'company_info', topic: 'nezu', prompt: 'quien es nezu' });

    expect(explain).toEqual(expect.objectContaining({ requiresConfirmation: false, intentType: 'unknown' }));
    expect(retry.summary).toBe('Retrying the last failed action.');
    expect(company.summary).toContain('NEZU S.A.S.');
  });
});