import { parseBoardManifestV1, type BoardManifestV1 } from './BoardManifestV1';

export const MANIFEST_BUNDLE_SCHEMA_VERSION = 'homepilot.manifest-bundle.v1' as const;

export interface ManifestBundleV1 {
  readonly schemaVersion: typeof MANIFEST_BUNDLE_SCHEMA_VERSION;
  readonly installationId: string;
  readonly manifests: ReadonlyArray<BoardManifestV1>;
}

export class ManifestBundleValidationError extends Error {
  readonly code = 'INTENTFLOW_MANIFEST_BUNDLE_INVALID';
  constructor() { super('INTENTFLOW_MANIFEST_BUNDLE_INVALID'); this.name = 'ManifestBundleValidationError'; }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseManifestBundleV1(value: unknown): ManifestBundleV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new ManifestBundleValidationError();
  const root = value as Record<string, unknown>;
  if (Object.keys(root).length !== 3
    || !['schemaVersion', 'installationId', 'manifests'].every((key) => Object.prototype.hasOwnProperty.call(root, key))
    || root.schemaVersion !== MANIFEST_BUNDLE_SCHEMA_VERSION
    || typeof root.installationId !== 'string' || !uuidPattern.test(root.installationId)
    || !Array.isArray(root.manifests)) throw new ManifestBundleValidationError();

  try {
    const manifests = root.manifests.map((item: unknown) => parseBoardManifestV1(item));
    if (manifests.some((item) => item.installationId !== root.installationId)
      || new Set(manifests.map((item) => item.boardId)).size !== manifests.length
      || new Set(manifests.map((item) => item.homePilotDeviceId)).size !== manifests.length) {
      throw new ManifestBundleValidationError();
    }
    return { schemaVersion: MANIFEST_BUNDLE_SCHEMA_VERSION, installationId: root.installationId, manifests };
  } catch {
    throw new ManifestBundleValidationError();
  }
}
