import { resolveCapabilitiesForDevice } from '../domain/CapabilityResolver';
import { CAPABILITY_DEFINITIONS } from '../domain/capabilities';
import { Device } from '../domain/types';

describe('CapabilityResolver', () => {
  const baseDevice: Device = {
    id: 'd1',
    homeId: 'h1',
    roomId: null,
    externalId: 'local:test',
    name: 'Test Device',
    type: 'light',
    vendor: 'test',
    status: 'ASSIGNED',
    integrationSource: 'local',
    invertState: false,
    lastKnownState: {},
    entityVersion: 1,
    createdAt: '',
    updatedAt: ''
  };

  it('should resolve capabilities from explicit device.capabilities', () => {
    const device: Device = {
      ...baseDevice,
      capabilities: [{ type: 'switch', name: 'Custom Switch' }]
    };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps).toHaveLength(1);
    expect(caps[0].type).toBe('switch');
  });

  it('should infer from device.type (lowercase)', () => {
    const device: Device = { ...baseDevice, type: 'cover' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('cover');
  });

  it('should infer from device.type (uppercase normalization)', () => {
    const device: Device = { ...baseDevice, type: 'SWITCH' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('switch');
  });

  it('should infer from Home Assistant externalId (ha:light.xxx)', () => {
    const device: Device = { 
      ...baseDevice, 
      externalId: 'ha:light.kitchen',
      type: 'unknown' // type should be ignored if HA id matches
    };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('light');
  });

  it('should infer from Home Assistant externalId (ha:cover.xxx)', () => {
    const device: Device = { ...baseDevice, externalId: 'ha:cover.living_room' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('cover');
  });

  it('should resolve Home Assistant media players as controllable media profiles', () => {
    const device: Device = { ...baseDevice, externalId: 'ha:media_player.tv', type: 'unknown' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('media_player');
    expect(CAPABILITY_DEFINITIONS.media_player.map((command) => command.name)).toEqual([
      'turn_on',
      'turn_off',
      'media_play',
      'media_pause',
    ]);
  });

  it('should resolve legacy imported Home Assistant cameras from externalId', () => {
    const device: Device = { ...baseDevice, externalId: 'ha:camera.garden', type: 'sensor' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('camera');
  });

  it('should infer sensor from Home Assistant (ha:sensor.xxx)', () => {
    const device: Device = { ...baseDevice, externalId: 'ha:sensor.temp' };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps[0].type).toBe('sensor');
  });

  it('should return empty array if nothing can be resolved', () => {
    const device: Device = { 
      ...baseDevice, 
      type: 'unknown_hardware',
      externalId: 'other:123' 
    };
    const caps = resolveCapabilitiesForDevice(device);
    expect(caps).toHaveLength(0);
  });
});
