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

  describe('Localization', () => {
    it('should return ES message for unknown intent by default', async () => {
      const intent: Intent = { type: 'unknown', prompt: 'haz magia', reason: 'Not understood' };
      const result = await policy.evaluate(intent);
      expect(result.summary).toBe('No pude interpretar esa instrucción.');
    });

    it('should return EN message for unknown intent when lang is en', async () => {
      const intent: Intent = { type: 'unknown', prompt: 'do magic', reason: 'Not understood' };
      const result = await policy.evaluate(intent, 'en');
      expect(result.summary).toBe('I could not interpret that instruction.');
    });

    it('should return EN reason for scene when lang is en', async () => {
      const scene = createTestScene({ name: 'Night', actions: [{ deviceId: '1', command: 'turn_on' }] });
      mockSceneRepo.findSceneById.mockResolvedValue(scene);
      
      const intent: Intent = { type: 'scene', target: 'scene_1', prompt: 'activate night mode' };
      const result = await policy.evaluate(intent, 'en');

      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toBe('Scenes always require confirmation.');
    });

    it('should return EN reason for global command when lang is en', async () => {
      const device = createTestDevice({ name: 'Home Group' });
      mockDeviceRepo.findDeviceById.mockResolvedValue(device);

      const intent: Intent = { type: 'command', deviceId: 'dev_1', command: 'turn_off', prompt: 'turn off every light' };
      const result = await policy.evaluate(intent, 'en');

      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toBe('Global commands require confirmation.');
    });
  });

  it('preview de unknown no requiere confirmación', async () => {
    const intent: Intent = { type: 'unknown', prompt: 'haz magia', reason: 'Not understood' };
    const result = await policy.evaluate(intent);
    
    expect(result.requiresConfirmation).toBe(false);
    expect(result.intentType).toBe('unknown');
    expect(result.summary).toBe('No pude interpretar esa instrucción.');
  });

  it('preview de scene requiere confirmación', async () => {
    const scene = createTestScene({ name: 'Noche', actions: [{ deviceId: '1', command: 'turn_on' }, { deviceId: '2', command: 'turn_off' }] });
    mockSceneRepo.findSceneById.mockResolvedValue(scene);
    
    const intent: Intent = { type: 'scene', target: 'scene_1', prompt: 'activa modo noche' };
    const result = await policy.evaluate(intent);

    expect(result.requiresConfirmation).toBe(true);
    expect(result.intentType).toBe('scene');
    expect(result.estimatedActionCount).toBe(2);
    expect(result.targetName).toBe('Noche');
  });

  it('command simple turn_on no requiere confirmación', async () => {
    const device = createTestDevice({ name: 'Luz Sala' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(device);

    const intent: Intent = { type: 'command', deviceId: 'dev_1', command: 'turn_on', prompt: 'prende la luz sala' };
    const result = await policy.evaluate(intent);

    expect(result.requiresConfirmation).toBe(false);
    expect(result.intentType).toBe('command');
  });

  it('command global turn_off requiere confirmación', async () => {
    const device = createTestDevice({ name: 'Grupo Casa' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(device);

    const intent: Intent = { type: 'command', deviceId: 'dev_1', command: 'turn_off', prompt: 'apaga toda la casa' };
    const result = await policy.evaluate(intent);

    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('globales');
  });

  it('command global turn_on requiere confirmación', async () => {
    const device = createTestDevice({ name: 'Grupo Casa' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(device);

    const intent: Intent = { type: 'command', deviceId: 'dev_1', command: 'turn_on', prompt: 'prende todas las luces' };
    const result = await policy.evaluate(intent);

    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('globales');
  });

  it('command de movimiento (open/close) requiere confirmación', async () => {
    const device = createTestDevice({ name: 'Cortina' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(device);

    const intent: Intent = { type: 'command', deviceId: 'dev_1', command: 'open', prompt: 'abre la cortina' };
    const result = await policy.evaluate(intent);

    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('movimiento');
  });
  it('uses unknown labels for missing scene or device records while preserving safety decisions', async () => {
    mockSceneRepo.findSceneById.mockResolvedValue(null);
    mockDeviceRepo.findDeviceById.mockResolvedValue(null);

    const scene = await policy.evaluate({ type: 'scene', target: 'missing', prompt: 'activa escena' });
    const command = await policy.evaluate({ type: 'command', deviceId: 'missing', command: 'turn_off', prompt: 'apaga luz' }, 'en');

    expect(scene).toEqual(expect.objectContaining({ targetName: 'Desconocido', estimatedActionCount: 0, requiresConfirmation: true }));
    expect(command).toEqual(expect.objectContaining({ targetName: 'Unknown', requiresConfirmation: false }));
  });

  it('requires confirmation for every multi-command and movement command variant', async () => {
    const multi = await policy.evaluate({
      type: 'multi_command', prompt: 'apaga sala y cocina', actions: [
        { deviceId: 'one', command: 'turn_off', targetName: 'Sala' },
        { deviceId: 'two', command: 'turn_off', targetName: 'Cocina' },
      ], requiresConfirmation: true,
    }, 'en');
    expect(multi).toEqual(expect.objectContaining({ requiresConfirmation: true, estimatedActionCount: 2, summary: 'I will execute 2 actions.' }));

    for (const command of ['close', 'stop', 'set_position']) {
      const result = await policy.evaluate({ type: 'command', deviceId: 'cover-1', command, prompt: 'cortina' } as Intent);
      expect(result).toEqual(expect.objectContaining({ requiresConfirmation: true }));
    }
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