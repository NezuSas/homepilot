import {
  getInstallationProfile,
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
});
