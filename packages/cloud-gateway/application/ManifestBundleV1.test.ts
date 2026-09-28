import { ManifestBundleValidationError, parseManifestBundleV1 } from './ManifestBundleV1';
import { BoardManifestValidationError, parseBoardManifestV1 } from './BoardManifestV1';

const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';
const deviceId = '33dfef68-0d46-4fdd-aef0-8b249a32de4e';
const secondDeviceId = '76512cb7-7c2e-4182-ac36-e43733277440';

function manifest(boardId = 5, homePilotDeviceId = deviceId) {
  return {
    schemaVersion: 'homepilot.board-manifest.v1', revision: 'a'.repeat(64), boardId,
    installationId, homePilotDeviceId, planId: 2, actions: [],
  };
}
function bundle() {
  return { schemaVersion: 'homepilot.manifest-bundle.v1', installationId, manifests: [manifest()] };
}

describe('ManifestBundleV1', () => {
  it('accepts a valid bundle and a valid empty revocation snapshot', () => {
    expect(parseManifestBundleV1(bundle()).manifests).toHaveLength(1);
    expect(parseManifestBundleV1({ ...bundle(), manifests: [] }).manifests).toEqual([]);
  });

  it('keeps legacy manifests valid and preserves an optional strict commercial entitlement', () => {
    expect(parseManifestBundleV1(bundle()).manifests[0].entitlement).toBeUndefined();
    const entitlement = {
      plan: { id: 2, name: 'Plan Premium', type: 'PREMIUM' },
      commands: [
        { key: 'hp_navigate_home', displayName: 'Inicio', implementationType: 'homepilot',
          controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false },
        { key: 'legacy_camera', displayName: 'Cámara', implementationType: 'legacy_adb',
          controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false },
      ],
    };
    expect(parseManifestBundleV1({ ...bundle(), manifests: [{ ...manifest(), entitlement }] })
      .manifests[0].entitlement).toEqual(entitlement);
  });

  it('rejects an entitlement whose plan does not match the manifest planId', () => {
    expect(() => parseBoardManifestV1({
      ...manifest(),
      entitlement: { plan: { id: 1, name: 'Plan Básico', type: 'BASIC' }, commands: [] },
    })).toThrow(BoardManifestValidationError);
  });

  it('rejects extra entitlement fields and any raw ADB payload', () => {
    const command = { key: 'legacy_camera', displayName: 'Cámara', implementationType: 'legacy_adb',
      controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false };
    const plan = { id: 2, name: 'Premium', type: 'PREMIUM' };
    for (const entitlement of [
      { plan, commands: [command], token: 'secret' },
      { plan: { ...plan, rawAdb: 'input keyevent 26' }, commands: [command] },
      { plan, commands: [{ ...command, command: 'input keyevent 26' }] },
      { plan, commands: [{ ...command, implementationConfig: { rawAdb: 'input keyevent 26' } }] },
    ]) {
      expect(() => parseManifestBundleV1({ ...bundle(), manifests: [{ ...manifest(), entitlement }] }))
        .toThrow(ManifestBundleValidationError);
    }
  });

  it.each([
    { ...bundle(), extra: 'not-allowed' },
    { ...bundle(), schemaVersion: 'another' },
    { ...bundle(), installationId: 'bad' },
    { ...bundle(), manifests: [{ ...manifest(), revision: 'invalid' }] },
    { ...bundle(), manifests: [{ ...manifest(), installationId: secondDeviceId }] },
    { ...bundle(), manifests: [manifest(), manifest(5, secondDeviceId)] },
    { ...bundle(), manifests: [manifest(), manifest(6, deviceId)] },
  ])('rejects an invalid whole bundle', (input) => {
    expect(() => parseManifestBundleV1(input)).toThrow(ManifestBundleValidationError);
  });
});
