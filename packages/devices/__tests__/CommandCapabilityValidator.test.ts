import { validateDeviceCommand } from '../domain/CommandCapabilityValidator';
import { Device } from '../domain/types';

describe('CommandCapabilityValidator', () => {
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

  it('should allow valid commands for light', () => {
    const result = validateDeviceCommand(baseDevice, { name: 'turn_on' });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid commands for light', () => {
    const result = validateDeviceCommand(baseDevice, { name: 'set_position', params: { position: 50 } });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no soportado');
  });

  it('should validate set_position parameters for cover', () => {
    const cover: Device = { ...baseDevice, type: 'cover' };
    
    // Valid
    expect(validateDeviceCommand(cover, { name: 'set_position', params: { position: 50 } }).valid).toBe(true);
    expect(validateDeviceCommand(cover, { name: 'set_position', params: { position: 0 } }).valid).toBe(true);
    expect(validateDeviceCommand(cover, { name: 'set_position', params: { position: 100 } }).valid).toBe(true);
    expect(validateDeviceCommand(cover, { name: 'set_position', params: { position: 50.5 } }).valid).toBe(true);

    // Missing required param
    const missing = validateDeviceCommand(cover, { name: 'set_position' });
    expect(missing.valid).toBe(false);
    expect(missing.error).toContain('requerido');

    // Wrong type - Testing validation by passing a string instead of a number
    const wrongType = validateDeviceCommand(cover, { 
      name: 'set_position', 
      params: { position: '50' as unknown as number } 
    });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.error).toContain('tipo number');

    // Out of range
    const outRangeLow = validateDeviceCommand(cover, { name: 'set_position', params: { position: -1 } });
    expect(outRangeLow.valid).toBe(false);
    expect(outRangeLow.error).toContain('mínimo');

    const outRangeHigh = validateDeviceCommand(cover, { name: 'set_position', params: { position: 101 } });
    expect(outRangeHigh.valid).toBe(false);
    expect(outRangeHigh.error).toContain('máximo');
  });

  it('should reject all operational commands for sensors', () => {
    const sensor: Device = { ...baseDevice, type: 'sensor' };
    const result = validateDeviceCommand(sensor, { name: 'turn_on' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tipo sensor');
  });

  it('should allow playback commands only for media players', () => {
    const mediaPlayer: Device = { ...baseDevice, type: 'media_player', externalId: 'ha:media_player.speaker' };

    expect(validateDeviceCommand(mediaPlayer, { name: 'media_play' }).valid).toBe(true);
    expect(validateDeviceCommand(mediaPlayer, { name: 'media_pause' }).valid).toBe(true);
    expect(validateDeviceCommand(baseDevice, { name: 'media_play' }).valid).toBe(false);
  });

  it('should allow commands for unknown devices (conservative fallback)', () => {
    const unknown: Device = { ...baseDevice, type: 'weird_device' };
    const result = validateDeviceCommand(unknown, { name: 'turn_on' });
    expect(result.valid).toBe(true);
  });
});
