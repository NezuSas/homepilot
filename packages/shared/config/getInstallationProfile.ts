export const installationProfiles = ['bridge_ha', 'native_only', 'ha_companion'] as const;

export type InstallationProfile = typeof installationProfiles[number];

export const runtimeTargets = ['linux_edge', 'docker_desktop', 'unknown'] as const;

export type RuntimeTarget = typeof runtimeTargets[number];

const DEFAULT_INSTALLATION_PROFILE: InstallationProfile = 'bridge_ha';
const DEFAULT_RUNTIME_TARGET: RuntimeTarget = 'unknown';

export function getInstallationProfile(value = process.env.HOMEPILOT_INSTALLATION_PROFILE): InstallationProfile {
  return installationProfiles.includes(value as InstallationProfile)
    ? value as InstallationProfile
    : DEFAULT_INSTALLATION_PROFILE;
}

export function installationProfileRequiresHomeAssistant(profile: InstallationProfile): boolean {
  return profile !== 'native_only';
}

export function getRuntimeTarget(value = process.env.HOMEPILOT_RUNTIME_TARGET): RuntimeTarget {
  return runtimeTargets.includes(value as RuntimeTarget)
    ? value as RuntimeTarget
    : DEFAULT_RUNTIME_TARGET;
}

export function getSetupHttpUrl(value = process.env.HOMEPILOT_HOME_ASSISTANT_SETUP_URL): string | null {
  if (!value) return null;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.toString().replace(/\/$/, '')
      : null;
  } catch {
    return null;
  }
}
