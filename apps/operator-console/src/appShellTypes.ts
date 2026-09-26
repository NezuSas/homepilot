export interface SetupStatus {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
  installationProfile: 'bridge_ha' | 'native_only' | 'ha_companion';
  requiresHomeAssistant: boolean;
  runtimeTarget: 'linux_edge' | 'docker_desktop' | 'unknown';
  homeAssistantBridgeUrl: string | null;
  homeAssistantSetupUrl: string | null;
}
