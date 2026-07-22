export const installationProfiles = ['bridge_ha', 'native_only', 'ha_companion'] as const;

export type InstallationProfile = typeof installationProfiles[number];

const DEFAULT_INSTALLATION_PROFILE: InstallationProfile = 'bridge_ha';

export function getInstallationProfile(value = process.env.HOMEPILOT_INSTALLATION_PROFILE): InstallationProfile {
  return installationProfiles.includes(value as InstallationProfile)
    ? value as InstallationProfile
    : DEFAULT_INSTALLATION_PROFILE;
}

export function installationProfileRequiresHomeAssistant(profile: InstallationProfile): boolean {
  return profile !== 'native_only';
}
