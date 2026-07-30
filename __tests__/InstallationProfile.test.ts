import {
  getInstallationProfile,
  getRuntimeTarget,
  getSetupHttpUrl,
  installationProfileRequiresHomeAssistant
} from '../packages/shared/config/getInstallationProfile';

describe('installation profiles', () => {
  it('uses bridge_ha as the safe compatibility default', () => {
    expect(getInstallationProfile(undefined)).toBe('bridge_ha');
    expect(getInstallationProfile('invalid-profile')).toBe('bridge_ha');
  });

  it('accepts the supported installation profiles', () => {
    expect(getInstallationProfile('bridge_ha')).toBe('bridge_ha');
    expect(getInstallationProfile('native_only')).toBe('native_only');
    expect(getInstallationProfile('ha_companion')).toBe('ha_companion');
  });

  it('requires Home Assistant only for bridge-based profiles', () => {
    expect(installationProfileRequiresHomeAssistant('bridge_ha')).toBe(true);
    expect(installationProfileRequiresHomeAssistant('ha_companion')).toBe(true);
    expect(installationProfileRequiresHomeAssistant('native_only')).toBe(false);
  });

  it('uses explicit supported runtime targets without inferring the host platform', () => {
    expect(getRuntimeTarget('linux_edge')).toBe('linux_edge');
    expect(getRuntimeTarget('docker_desktop')).toBe('docker_desktop');
    expect(getRuntimeTarget('unsupported')).toBe('unknown');
  });

  it('only exposes safe HTTP URLs for setup guidance', () => {
    expect(getSetupHttpUrl('http://host.docker.internal:18123/')).toBe('http://host.docker.internal:18123');
    expect(getSetupHttpUrl('https://home.example.com/')).toBe('https://home.example.com');
    expect(getSetupHttpUrl('ftp://home.example.com')).toBeNull();
    expect(getSetupHttpUrl('not a url')).toBeNull();
  });
});
