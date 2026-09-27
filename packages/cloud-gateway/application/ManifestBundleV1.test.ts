import { ManifestBundleValidationError, parseManifestBundleV1 } from './ManifestBundleV1';

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
