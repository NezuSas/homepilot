import { AssistantFastPathResolver } from '../application/AssistantFastPathResolver';
import { Device } from '../../devices/domain/types';

describe('AssistantFastPathResolver', () => {
  const resolver = new AssistantFastPathResolver();

  const mockDevices = [
    { id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' } as Device,
    { id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'r2' } as Device,
    { id: 'd3', name: 'Luz Pasillo', type: 'light', roomId: 'r3' } as Device,
    { id: 'd4', name: 'Ventilador', type: 'switch', roomId: 'r4' } as Device,
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
});
