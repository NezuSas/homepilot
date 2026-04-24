import { DefaultDeviceDriverRegistry } from '../infrastructure/drivers/DefaultDeviceDriverRegistry';
import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../domain/drivers/DeviceDriver';
import { Device } from '../domain/types';
import { DriverNotFoundError } from '../domain/drivers/DeviceDriverRegistry';

describe('DeviceDriverRegistry', () => {
  let registry: DefaultDeviceDriverRegistry;
  let mockDriver: DeviceDriver;

  beforeEach(() => {
    registry = new DefaultDeviceDriverRegistry();
    mockDriver = {
      supports: jest.fn().mockReturnValue(true),
      executeCommand: jest.fn().mockResolvedValue({ success: true })
    };
  });

  it('should register and resolve a driver correctly', () => {
    registry.register('ha', mockDriver);
    const resolved = registry.resolve('ha');
    expect(resolved).toBe(mockDriver);
  });

  it('should throw DriverNotFoundError if source is not registered', () => {
    expect(() => registry.resolve('unknown')).toThrow(DriverNotFoundError);
    expect(() => registry.resolve('unknown')).toThrow('No se encontró un driver registrado para la fuente de integración: unknown');
  });

  it('should support multiple drivers', () => {
    const sonoffDriver = { ...mockDriver };
    registry.register('ha', mockDriver);
    registry.register('sonoff', sonoffDriver);

    expect(registry.resolve('ha')).toBe(mockDriver);
    expect(registry.resolve('sonoff')).toBe(sonoffDriver);
  });
});
