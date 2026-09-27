import { ManifestSyncService, manifestFreshness, SYNC_INTERVAL_MS } from './ManifestSyncService';

const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';
const bundle = { schemaVersion: 'homepilot.manifest-bundle.v1', installationId, manifests: [] };

describe('ManifestSyncService', () => {
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('starts immediately, repeats every minute and stops its timer', async () => {
    jest.useFakeTimers();
    const directory = { requestToken: jest.fn().mockResolvedValue('ephemeral') };
    const intentFlow = { getManifests: jest.fn().mockResolvedValue(bundle) };
    const cache = { replaceSnapshot: jest.fn() };
    const service = new ManifestSyncService({ directory, intentFlow, cache });
    service.start();
    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(2);
    expect(cache.replaceSnapshot).toHaveBeenCalledTimes(2);
    service.stop();
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(2);
  });

  it('does not overlap and requests a new service token on the next interval', async () => {
    jest.useFakeTimers();
    let completeFirst: ((value: string) => void) | undefined;
    const first = new Promise<string>((resolve) => { completeFirst = resolve; });
    const directory = { requestToken: jest.fn().mockReturnValueOnce(first).mockResolvedValue('second-token') };
    const intentFlow = { getManifests: jest.fn().mockResolvedValue(bundle) };
    const cache = { replaceSnapshot: jest.fn() };
    const service = new ManifestSyncService({ directory, intentFlow, cache });
    service.start();
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    completeFirst?.('first-token');
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(2);
    expect(intentFlow.getManifests.mock.calls.map((call: [string]) => call[0]))
      .toEqual(['first-token', 'second-token']);
    service.stop();
  });

  it('preserves cache on network failure and waits for normal next interval', async () => {
    jest.useFakeTimers();
    const directory = { requestToken: jest.fn().mockRejectedValue(new Error('secret-bearing failure')) };
    const intentFlow = { getManifests: jest.fn() };
    const cache = { replaceSnapshot: jest.fn() };
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new ManifestSyncService({ directory, intentFlow, cache });
    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(cache.replaceSnapshot).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('[IntentFlow Manifest Sync] INTENTFLOW_MANIFEST_SYNC_FAILED');
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS - 1);
    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('rejects an invalid bundle without replacing cache or logging its payload', async () => {
    const invalidPayload = { ...bundle, manifests: 'secret-payload-never-log' };
    const directory = { requestToken: jest.fn().mockResolvedValue('ephemeral') };
    const intentFlow = { getManifests: jest.fn().mockResolvedValue(invalidPayload) };
    const cache = { replaceSnapshot: jest.fn() };
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await new ManifestSyncService({ directory, intentFlow, cache }).syncOnce();

    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    expect(intentFlow.getManifests).toHaveBeenCalledWith('ephemeral');
    expect(cache.replaceSnapshot).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('[IntentFlow Manifest Sync] INTENTFLOW_MANIFEST_BUNDLE_INVALID');
    expect(JSON.stringify(warning.mock.calls)).not.toContain('secret-payload-never-log');
  });

  it('stops future cycles while an existing sync remains in flight', async () => {
    jest.useFakeTimers();
    let finishRequest: ((token: string) => void) | undefined;
    const pendingToken = new Promise<string>((resolve) => { finishRequest = resolve; });
    const directory = { requestToken: jest.fn().mockReturnValue(pendingToken) };
    const intentFlow = { getManifests: jest.fn().mockResolvedValue(bundle) };
    const cache = { replaceSnapshot: jest.fn() };
    const service = new ManifestSyncService({ directory, intentFlow, cache });

    service.start();
    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    service.stop();
    await jest.advanceTimersByTimeAsync(3 * SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(1);

    finishRequest?.('in-flight-token');
    await jest.advanceTimersByTimeAsync(0);
    expect(intentFlow.getManifests).toHaveBeenCalledWith('in-flight-token');
    expect(cache.replaceSnapshot).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2 * SYNC_INTERVAL_MS);
    expect(directory.requestToken).toHaveBeenCalledTimes(1);
    expect(cache.replaceSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('manifest freshness', () => {
  const now = Date.parse('2026-09-27T12:00:00.000Z');
  const ago = (duration: number): string => new Date(now - duration).toISOString();
  it('distinguishes fresh, offline grace and expired at exact boundaries', () => {
    expect(manifestFreshness(ago(5 * 60_000), now)).toBe('FRESH');
    expect(manifestFreshness(ago(5 * 60_000 + 1), now)).toBe('OFFLINE_GRACE');
    expect(manifestFreshness(ago(24 * 60 * 60_000), now)).toBe('OFFLINE_GRACE');
    expect(manifestFreshness(ago(24 * 60 * 60_000 + 1), now)).toBe('EXPIRED');
    expect(manifestFreshness(null, now)).toBe('EXPIRED');
  });
});
