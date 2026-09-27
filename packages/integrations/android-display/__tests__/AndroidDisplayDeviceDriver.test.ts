import type { Device } from '../../../devices/domain/types';
import { validateDeviceCommand } from '../../../devices/domain/CommandCapabilityValidator';
import { isValidCommand } from '../../../devices/domain/commands';
import { DefaultDeviceDriverRegistry } from '../../../devices/infrastructure/drivers/DefaultDeviceDriverRegistry';
import type { AndroidDisplayBridgePort } from '../application/AndroidDisplayBridgePort';
import type { AndroidDisplaySourceRepository } from '../domain/AndroidDisplaySource';
import { AndroidDisplayDeviceDriver } from '../infrastructure/AndroidDisplayDeviceDriver';

const device: Device = {
  id: 'device-1', homeId: 'home-1', roomId: null, externalId: 'android-display:device-1',
  name: 'Pizarra', type: 'smart_display', semanticType: 'smart_display', vendor: 'Droidlogic',
  status: 'PENDING', integrationSource: 'android-display', invertState: false,
  lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '',
};

describe('AndroidDisplayDeviceDriver and explicit capabilities', () => {
  const metadata = { adbSerial: null, androidId: 'known', manufacturer: null, model: null,
    androidVersion: null, resolution: null, densityDpi: null, screenState: 'unknown' as const };
  let bridge: jest.Mocked<AndroidDisplayBridgePort>;
  let driver: AndroidDisplayDeviceDriver;
  beforeEach(() => {
    bridge = {
      connect: jest.fn().mockResolvedValue('online'), state: jest.fn().mockResolvedValue('online'),
      inspect: jest.fn().mockResolvedValue(metadata), execute: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const sources = { findByDeviceId: jest.fn().mockReturnValue({
      deviceId: device.id, homeId: device.homeId, adbHost: '192.168.1.37', adbPort: 5555,
      enabled: true, connectionState: 'online', metadata,
    }) } as unknown as AndroidDisplaySourceRepository;
    driver = new AndroidDisplayDeviceDriver(sources, bridge);
  });

  it('registers in the ordinary driver registry', () => {
    const registry = new DefaultDeviceDriverRegistry();
    registry.register('android-display', driver);
    expect(registry.resolve('android-display')).toBe(driver);
  });

  it.each(['navigate_home', 'navigate_back'] as const)('executes %s through the typed bridge', async (name) => {
    expect(validateDeviceCommand(device, { name }).valid).toBe(true);
    expect((await driver.executeCommand(device, { name }, { userId: 'u', correlationId: 'c' })).success).toBe(true);
    expect(bridge.execute).toHaveBeenCalledWith(device.id, name, {});
  });

  it('executes volume_set only with an integer percentage', async () => {
    expect(validateDeviceCommand(device, { name: 'volume_set', params: { volume: 42 } }).valid).toBe(true);
    expect((await driver.executeCommand(device, { name: 'volume_set', params: { volume: 42 } },
      { userId: 'u', correlationId: 'c' })).success).toBe(true);
    expect(bridge.execute).toHaveBeenCalledWith(device.id, 'volume_set', { volume: 42 });
    expect(validateDeviceCommand(device, { name: 'volume_set', params: { volume: 42, shell: 'x' } }).valid).toBe(false);
  });

  it('fails closed without the explicit semantic classification and rejects unsupported actions', async () => {
    expect(validateDeviceCommand({ ...device, semanticType: null }, { name: 'navigate_home' }).valid).toBe(false);
    expect(validateDeviceCommand(device, { name: 'turn_on' }).valid).toBe(false);
    expect(isValidCommand('sleep')).toBe(false);
    expect(isValidCommand('power_toggle')).toBe(false);
    expect(isValidCommand('reboot')).toBe(false);
    expect((await driver.executeCommand(device, { name: 'turn_on' }, { userId: 'u', correlationId: 'c' })).success).toBe(false);
    expect(bridge.execute).not.toHaveBeenCalled();
  });

  it('does not let the legacy unknown-device fallback accept Android navigation', () => {
    const legacyUnknown: Device = { ...device, integrationSource: 'local', type: 'unknown', semanticType: null };
    expect(validateDeviceCommand(legacyUnknown, { name: 'navigate_home' }).valid).toBe(false);
    expect(validateDeviceCommand(legacyUnknown, { name: 'navigate_back' }).valid).toBe(false);
  });

  it('does not execute after an identity mismatch or bridge failure', async () => {
    bridge.inspect.mockResolvedValueOnce({ ...metadata, androidId: 'other' });
    expect((await driver.executeCommand(device, { name: 'navigate_home' },
      { userId: 'u', correlationId: 'c' })).error).toBe('DISPLAY_IDENTITY_MISMATCH');
    bridge.connect.mockRejectedValueOnce(new Error('secret internal details'));
    expect((await driver.executeCommand(device, { name: 'navigate_home' },
      { userId: 'u', correlationId: 'c' })).error).toBe('DISPLAY_BRIDGE_UNAVAILABLE');
    expect(bridge.execute).not.toHaveBeenCalled();
  });
});
