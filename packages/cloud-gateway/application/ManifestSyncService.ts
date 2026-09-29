import { parseManifestBundleV1 } from './ManifestBundleV1';

const safeErrorCodes = new Set([
  'INTENTFLOW_EDGE_NOT_PAIRED', 'INTENTFLOW_DIRECTORY_REJECTED',
  'INTENTFLOW_DIRECTORY_UNAVAILABLE', 'INTENTFLOW_DIRECTORY_TIMEOUT',
  'INTENTFLOW_DIRECTORY_RESPONSE_INVALID', 'INTENTFLOW_MANIFEST_CONFIG_INVALID',
  'DEVICE_IDENTITY_INVALID',
  'INTENTFLOW_MANIFEST_REJECTED', 'INTENTFLOW_MANIFEST_UNAVAILABLE',
  'INTENTFLOW_MANIFEST_TIMEOUT', 'INTENTFLOW_MANIFEST_RESPONSE_INVALID',
  'INTENTFLOW_MANIFEST_BUNDLE_INVALID', 'INTENTFLOW_INSTALLATION_MISMATCH',
]);

function safeErrorCode(error: unknown): string {
  if (error === null || typeof error !== 'object' || !('code' in error)) return 'INTENTFLOW_MANIFEST_SYNC_FAILED';
  const code = error.code;
  return typeof code === 'string' && safeErrorCodes.has(code) ? code : 'INTENTFLOW_MANIFEST_SYNC_FAILED';
}

export const SYNC_INTERVAL_MS = 60_000;
export const CACHE_FRESH_MS = 5 * 60_000;
export const OFFLINE_GRACE_MS = 24 * 60 * 60_000;
export type ManifestFreshness = 'FRESH' | 'OFFLINE_GRACE' | 'EXPIRED';

export function manifestFreshness(lastSuccessAt: string | null, now = Date.now()): ManifestFreshness {
  if (!lastSuccessAt) return 'EXPIRED';
  const age = now - Date.parse(lastSuccessAt);
  if (!Number.isFinite(age) || age < 0) return 'EXPIRED';
  if (age <= CACHE_FRESH_MS) return 'FRESH';
  if (age <= OFFLINE_GRACE_MS) return 'OFFLINE_GRACE';
  return 'EXPIRED';
}

export interface ManifestSyncPorts {
  readonly directory: { requestToken(): Promise<string> };
  readonly intentFlow: { getManifests(token: string): Promise<unknown> };
  readonly cache: { replaceSnapshot(bundle: ReturnType<typeof parseManifestBundleV1>, syncedAt: string): void };
}

/** One immediate sync, then ordinary periodic retries; no overlapping work. */
export class ManifestSyncService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(private readonly ports: ManifestSyncPorts, private readonly now: () => Date = () => new Date()) {}

  start(): void {
    if (this.timer) return;
    console.log('[IntentFlow Manifest Sync] started');
    void this.syncOnce();
    this.timer = setInterval(() => { void this.syncOnce(); }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async syncOnce(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      const token = await this.ports.directory.requestToken();
      const payload = await this.ports.intentFlow.getManifests(token);
      const bundle = parseManifestBundleV1(payload);
      this.ports.cache.replaceSnapshot(bundle, this.now().toISOString());
      console.log(`[IntentFlow Manifest Sync] success: ${bundle.manifests.length} manifests`);
    } catch (error) {
      console.warn(`[IntentFlow Manifest Sync] ${safeErrorCode(error)}`);
    } finally { this.active = false; }
  }
}
