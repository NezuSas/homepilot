import type { SetupStatus } from '../appShellTypes';
import {
  buildReadinessItems,
  canTestHomeAssistantConnection,
  extractApiErrorMessage,
  getErrorMessage,
  getRuntimeLabelKey
} from './onboardingSetup';

const status: SetupStatus = {
  isInitialized: false,
  requiresOnboarding: true,
  hasAdminUser: true,
  hasHAConfig: true,
  haConnectionValid: false,
  installationProfile: 'bridge_ha',
  requiresHomeAssistant: true,
  runtimeTarget: 'docker_desktop',
  homeAssistantBridgeUrl: null,
  homeAssistantSetupUrl: null
};

describe('onboardingSetup', () => {
  it('extracts API error messages from object, string and missing payloads', () => {
    expect(extractApiErrorMessage({ error: { message: 'boom' } }, 'fallback')).toBe('boom');
    expect(extractApiErrorMessage({ error: 'plain' }, 'fallback')).toBe('plain');
    expect(extractApiErrorMessage({ error: { message: '' } }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage({ success: false }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('uses the error message only for Error instances', () => {
    expect(getErrorMessage(new Error('x'), 'fallback')).toBe('x');
    expect(getErrorMessage('x', 'fallback')).toBe('fallback');
  });

  it('maps runtime targets to translation keys', () => {
    expect(getRuntimeLabelKey('docker_desktop')).toBe('onboarding.step2.runtime_docker_desktop');
    expect(getRuntimeLabelKey('linux_edge')).toBe('onboarding.step2.runtime_linux_edge');
    expect(getRuntimeLabelKey('unknown')).toBe('onboarding.step2.runtime_unknown');
    expect(getRuntimeLabelKey(undefined)).toBe('onboarding.step2.runtime_unknown');
  });

  it('only allows testing with credentials while idle', () => {
    expect(canTestHomeAssistantConnection('http://ha', 'token', { testing: false, saving: false })).toBe(true);
    expect(canTestHomeAssistantConnection('', 'token', { testing: false, saving: false })).toBe(false);
    expect(canTestHomeAssistantConnection('http://ha', '', { testing: false, saving: false })).toBe(false);
    expect(canTestHomeAssistantConnection('http://ha', 'token', { testing: true, saving: false })).toBe(false);
    expect(canTestHomeAssistantConnection('http://ha', 'token', { testing: false, saving: true })).toBe(false);
  });

  it('builds readiness rows and omits Home Assistant rows for native-only installs', () => {
    const bridge = buildReadinessItems(status, true, false, 'admin');
    expect(bridge.map(item => item.status)).toEqual(['success', 'success', 'warning']);
    expect(bridge[0]).toMatchObject({ valueKey: 'onboarding.step1.ok', valueSuffix: ' (admin)' });

    const native = buildReadinessItems(status, false, true, undefined);
    expect(native).toEqual([
      { labelKey: 'onboarding.step1.admin', valueKey: 'onboarding.step1.missing', valueSuffix: undefined, status: 'error' }
    ]);
  });
});
