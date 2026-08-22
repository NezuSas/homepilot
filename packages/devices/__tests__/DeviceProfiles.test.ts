import {
  getHomeAssistantDeviceProfile,
  listSupportedHomeAssistantDomains,
  normalizeHomeAssistantDomain,
} from '../domain/deviceProfiles';

describe('DeviceProfiles', () => {
  it('normalizes Home Assistant entity ids and external ids to domains', () => {
    expect(normalizeHomeAssistantDomain('cover.cortina_master')).toBe('cover');
    expect(normalizeHomeAssistantDomain('ha:switch.sonoff_mini')).toBe('switch');
  });

  it('defines cover as a configurable curtain profile with position commands', () => {
    const profile = getHomeAssistantDeviceProfile('cover.cortina_master');

    expect(profile.type).toBe('cover');
    expect(profile.semanticType).toBe('cover');
    expect(profile.supportedCommands).toEqual(['open', 'close', 'stop', 'set_position']);
    expect(profile.configurationSections.map((section) => section.id)).toContain('cover_behavior');
  });

  it('keeps Home Assistant switches as switches without guessing light semantics', () => {
    const profile = getHomeAssistantDeviceProfile('switch.sonoff_luz_sala');

    expect(profile.type).toBe('switch');
    expect(profile.semanticType).toBeUndefined();
    expect(profile.supportedCommands).toEqual(['turn_on', 'turn_off', 'toggle']);
  });

  it('exposes supported discovery domains from the profile catalog', () => {
    expect(listSupportedHomeAssistantDomains()).toEqual([
      'light',
      'switch',
      'cover',
      'sensor',
      'binary_sensor',
      'climate',
      'media_player',
      'button',
      'scene',
      'camera',
    ]);
  });

  it('defines Home Assistant buttons as stateless press actions', () => {
    const profile = getHomeAssistantDeviceProfile('button.gate_release');

    expect(profile.type).toBe('button');
    expect(profile.semanticType).toBe('button');
    expect(profile.supportedCommands).toEqual(['press']);
  });

  it('defines Home Assistant scenes as stateless activate actions', () => {
    const profile = getHomeAssistantDeviceProfile('scene.tv_input');

    expect(profile.type).toBe('scene');
    expect(profile.semanticType).toBe('scene');
    expect(profile.supportedCommands).toEqual(['activate']);
  });

  it('defines Home Assistant cameras as read-only media devices', () => {
    const profile = getHomeAssistantDeviceProfile('camera.ingreso');

    expect(profile.type).toBe('camera');
    expect(profile.category).toBe('media');
    expect(profile.supportedCommands).toEqual([]);
  });
  it('defines climate as a controllable profile with parameterized commands', () => {
    const profile = getHomeAssistantDeviceProfile('climate.sala');

    expect(profile.supportedCommands).toEqual([
      'turn_on', 'turn_off', 'toggle', 'set_temperature', 'set_hvac_mode', 'set_fan_mode',
    ]);
    expect(profile.configurationSections.map((section) => section.id)).not.toContain('read_only');
  });
});
