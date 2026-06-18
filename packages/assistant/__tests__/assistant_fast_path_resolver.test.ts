import { AssistantFastPathResolver } from '../application/AssistantFastPathResolver';
import { Device } from '../../devices/domain/types';

describe('AssistantFastPathResolver', () => {
  const resolver = new AssistantFastPathResolver();

  const mockDevices = [
    { id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' } as Device,
    { id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'r2' } as Device,
    { id: 'd3', name: 'Luz Pasillo', type: 'light', roomId: 'r3' } as Device,
    { id: 'd4', name: 'Ventilador', type: 'switch', roomId: 'r4' } as Device,
    { id: 'd5', name: 'Cortina Sala Curtain', type: 'cover', roomId: 'r2' } as Device,
  ];

  it('resolves exact match "prende luz cocina"', () => {
    const result = resolver.resolve('prende luz cocina', mockDevices);
    expect(result).toEqual({
      deviceId: 'd1',
      deviceName: 'Luz Cocina',
      command: 'turn_on',
      confidence: 1.0
    });
  });

  it('resolves exact match with stopwords "apaga la luz de cocina"', () => {
    const result = resolver.resolve('apaga la luz de cocina', mockDevices);
    expect(result).toEqual({
      deviceId: 'd1',
      deviceName: 'Luz Cocina',
      command: 'turn_off',
      confidence: 1.0
    });
  });

  it('resolves exact match "enciende luz sala"', () => {
    const result = resolver.resolve('enciende luz sala', mockDevices);
    expect(result).toEqual({
      deviceId: 'd2',
      deviceName: 'Luz Sala',
      command: 'turn_on',
      confidence: 1.0
    });
  });

  it('resolves with typo "prende luy cosina"', () => {
    const result = resolver.resolve('prende luy cosina', mockDevices);
    expect(result).toEqual({
      deviceId: 'd1',
      deviceName: 'Luz Cocina',
      command: 'turn_on',
      confidence: 1.0
    });
  });

  it('resolves natural Spanish phrases without requiring the verb at the start', () => {
    const result = resolver.resolve('oye HomePilot me puedes apagar la luz de la sala por favor', mockDevices);
    expect(result).toEqual({
      deviceId: 'd2',
      deviceName: 'Luz Sala',
      command: 'turn_off',
      confidence: 1.0
    });
  });

  it('resolves imperfect speech transcription fragments for turn off commands', () => {
    const result = resolver.resolve('quiero que a pa eso luz sala', mockDevices);
    expect(result).toEqual({
      deviceId: 'd2',
      deviceName: 'Luz Sala',
      command: 'turn_off',
      confidence: 1.0
    });
  });

  it('resolves courtesy phrases with filler words after the command', () => {
    const result = resolver.resolve('cuando puedas enciende por favor la luz de cocina', mockDevices);
    expect(result).toEqual({
      deviceId: 'd1',
      deviceName: 'Luz Cocina',
      command: 'turn_on',
      confidence: 1.0
    });
  });

  it('returns null for room-only targets so contextual resolvers can handle them', () => {
    const result = resolver.resolve('me ayudas a apagar cocina', mockDevices);
    expect(result).toBeNull();
  });

  it('resolves English natural phrases through the same safe path', () => {
    const result = resolver.resolve('hey HomePilot could you turn on the kitchen light please', [
      { id: 'd1', name: 'Kitchen Light', type: 'light', roomId: 'r1' } as Device
    ]);
    expect(result).toEqual({
      deviceId: 'd1',
      deviceName: 'Kitchen Light',
      command: 'turn_on',
      confidence: 1.0
    });
  });

  it('resolves opening the living room curtain to the cover open command', () => {
    const result = resolver.resolve('abre la cortina de la sala', mockDevices);
    expect(result).toEqual({
      deviceId: 'd5',
      deviceName: 'Cortina Sala Curtain',
      command: 'open',
      confidence: 0.92
    });
  });

  it('resolves closing the living room curtain to the cover close command', () => {
    const result = resolver.resolve('cierra la cortina de la sala', mockDevices);
    expect(result).toEqual({
      deviceId: 'd5',
      deviceName: 'Cortina Sala Curtain',
      command: 'close',
      confidence: 0.92
    });
  });

  it('resolves a generic curtain command when exactly one cover is available', () => {
    const result = resolver.resolve('cierra la cortina', [
      ...mockDevices,
      { ...mockDevices[4], id: 'd6', name: 'Cortina Master', roomId: 'r1', lastKnownState: { state: 'unavailable' } }
    ]);

    expect(result).toEqual({
      deviceId: 'd5',
      deviceName: 'Cortina Sala Curtain',
      command: 'close',
      confidence: 1.0
    });
  });

  it('keeps a generic curtain command unresolved when multiple covers are available', () => {
    const result = resolver.resolve('abre la cortina', [
      ...mockDevices,
      { ...mockDevices[4], id: 'd6', name: 'Cortina Master', roomId: 'r1', lastKnownState: { state: 'closed' } }
    ]);

    expect(result).toBeNull();
  });

  it('returns null for ambiguous target "enciende luz"', () => {
    const result = resolver.resolve('enciende luz', mockDevices);
    expect(result).toBeNull();
  });

  it('returns null for state queries "qué luces están encendidas"', () => {
    const result = resolver.resolve('qué luces están encendidas', mockDevices);
    expect(result).toBeNull(); // No verb matches (prende, apaga, alterna)
  });

  it('returns null for multiple targets "enciende todas las luces"', () => {
    const result = resolver.resolve('enciende todas las luces', mockDevices);
    // "todas luces" doesn't strongly match any specific device by >= 0.9 confidence or is ambiguous
    expect(result).toBeNull();
  });

  it('returns null for bulk light commands so confirmation flows handle them', () => {
    const result = resolver.resolve('apaga todas las luces sala', mockDevices);
    expect(result).toBeNull();
  });
});
