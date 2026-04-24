import { HomeAssistantDeviceDriver } from '../infrastructure/HomeAssistantDeviceDriver';
import { Device } from '../../../../packages/devices/domain/types';
import { HomeAssistantConnectionProvider } from '../application/HomeAssistantConnectionProvider';
import { HomeAssistantClient } from '../../../../packages/devices/infrastructure/adapters/HomeAssistantClient';

describe('HomeAssistantDeviceDriver', () => {
  let driver: HomeAssistantDeviceDriver;
  let mockConnectionProvider: jest.Mocked<HomeAssistantConnectionProvider>;
  let mockClient: jest.Mocked<HomeAssistantClient>;

  const mockDevice: Device = {
    id: 'd1',
    homeId: 'h1',
    roomId: null,
    externalId: 'ha:light.test',
    name: 'Test Light',
    type: 'LIGHT',
    vendor: 'test',
    status: 'ASSIGNED',
    integrationSource: 'ha',
    invertState: false,
    lastKnownState: { on: false },
    createdAt: '',
    updatedAt: '',
    entityVersion: 1
  };

  beforeEach(() => {
    mockClient = {
      callService: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<HomeAssistantClient>;

    mockConnectionProvider = {
      hasClient: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(mockClient)
    } as unknown as jest.Mocked<HomeAssistantConnectionProvider>;
    
    driver = new HomeAssistantDeviceDriver(mockConnectionProvider);
  });

  it('should support ha and home_assistant sources', () => {
    expect(driver.supports(mockDevice)).toBe(true);
    expect(driver.supports({ ...mockDevice, integrationSource: 'home_assistant' })).toBe(true);
    expect(driver.supports({ ...mockDevice, integrationSource: 'sonoff' })).toBe(false);
  });

  it('should execute turn_on command correctly', async () => {
    const result = await driver.executeCommand(
      mockDevice, 
      { name: 'turn_on' }, 
      { userId: 'u1', correlationId: 'c1' }
    );

    expect(result.success).toBe(true);
    expect(mockClient.callService).toHaveBeenCalledWith('homeassistant', 'turn_on', 'light.test');
    expect(result.newState).toMatchObject({ on: true, state: 'on' });
  });

  it('should execute toggle command with optimistic calculation', async () => {
    const result = await driver.executeCommand(
      mockDevice, 
      { name: 'toggle' }, 
      { userId: 'u1', correlationId: 'c1' }
    );

    expect(result.success).toBe(true);
    expect(result.newState?.on).toBe(true);

    // Toggle again
    const result2 = await driver.executeCommand(
      { ...mockDevice, lastKnownState: { on: true } }, 
      { name: 'toggle' }, 
      { userId: 'u1', correlationId: 'c1' }
    );
    expect(result2.newState?.on).toBe(false);
  });

  it('should return error if connection is not configured', async () => {
    mockConnectionProvider.hasClient.mockReturnValue(false);
    const result = await driver.executeCommand(mockDevice, { name: 'turn_on' }, { userId: 'u1', correlationId: 'c1' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Integración de Home Assistant no configurada');
  });

  it('should return error for unsupported domain/command combination', async () => {
    const sensorDevice = { ...mockDevice, externalId: 'ha:sensor.test' };
    const result = await driver.executeCommand(sensorDevice, { name: 'open' }, { userId: 'u1', correlationId: 'c1' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Comando open no soportado para el dominio sensor');
  });
});
