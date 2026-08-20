/// <reference types="jest" />
import { apiFetch } from '../lib/apiClient';
import { useDeviceSnapshotStore } from './useDeviceSnapshotStore';

jest.mock('../lib/apiClient');
jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

const mockApiFetch = apiFetch as jest.Mock;

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('Feature: shared device snapshot synchronization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useDeviceSnapshotStore.getState().resetSnapshotState();
  });

  it('Scenario: Given a pre-command refresh is in flight When the assistant forces a refresh Then it performs one follow-up fetch with the post-command state', async () => {
    const initialDevices = deferred<Response>();
    let deviceRequestCount = 0;

    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/devices')) {
        deviceRequestCount += 1;
        if (deviceRequestCount === 1) return initialDevices.promise;
        return Promise.resolve(jsonResponse([{
          id: 'light-1',
          homeId: 'home-1',
          roomId: 'room-1',
          name: 'Sala',
          type: 'light',
          status: 'ASSIGNED',
          lastKnownState: { isOn: true },
        }]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    const initialRefresh = useDeviceSnapshotStore.getState().refreshSnapshot();
    const forcedRefresh = useDeviceSnapshotStore.getState().refreshSnapshot({ force: true });
    const duplicateForcedRefresh = useDeviceSnapshotStore.getState().refreshSnapshot({ force: true });

    expect(deviceRequestCount).toBe(1);
    expect(forcedRefresh).toBe(duplicateForcedRefresh);

    initialDevices.resolve(jsonResponse([{
      id: 'light-1',
      homeId: 'home-1',
      roomId: 'room-1',
      name: 'Sala',
      type: 'light',
      status: 'ASSIGNED',
      lastKnownState: { isOn: false },
    }]));

    await Promise.all([initialRefresh, forcedRefresh]);

    expect(deviceRequestCount).toBe(2);
    expect(useDeviceSnapshotStore.getState().devices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'light-1',
        lastKnownState: { isOn: true },
      }),
    ]));
  });

  it('Scenario: Given a forced refresh is queued When the session snapshot is reset Then it does not fetch after the reset', async () => {
    const initialDevices = deferred<Response>();
    let deviceRequestCount = 0;

    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/devices')) {
        deviceRequestCount += 1;
        return initialDevices.promise;
      }
      return Promise.resolve(jsonResponse([]));
    });

    const initialRefresh = useDeviceSnapshotStore.getState().refreshSnapshot();
    const queuedRefresh = useDeviceSnapshotStore.getState().refreshSnapshot({ force: true });
    useDeviceSnapshotStore.getState().resetSnapshotState();
    initialDevices.resolve(jsonResponse([]));

    await Promise.all([initialRefresh, queuedRefresh]);

    expect(deviceRequestCount).toBe(1);
    expect(useDeviceSnapshotStore.getState().devices).toEqual([]);
  });
});