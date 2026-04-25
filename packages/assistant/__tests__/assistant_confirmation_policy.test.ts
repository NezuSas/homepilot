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
});

