/// <reference types="jest" />
import { apiFetch } from '../lib/apiClient';
import { applyModbusRealtimeState, isKnownModbusStateEvent, useDeviceSnapshotStore, type SnapshotDevice } from './useDeviceSnapshotStore';
import type { RealtimeEventMessage } from './useAppShellStore';

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

describe('Feature: immediate PLC dashboard state (AC36)', () => {
  const device: SnapshotDevice = {
    id: 'plc-1', homeId: 'home-1', roomId: 'room-1', name: 'Temperature', type: 'sensor',
    status: 'ASSIGNED', integrationSource: 'modbus-tcp', lastKnownState: { value: 20 },
    updatedAt: '2026-10-04T12:00:00.000Z', entityVersion: 5,
  };
  const event: RealtimeEventMessage = {
    type: 'DeviceStateUpdatedEvent', timestamp: '2026-10-04T12:00:01.000Z',
    payload: { deviceId: 'plc-1', homeId: 'home-1', newState: { value: 21 } },
  };
  beforeEach(() => {
    jest.resetAllMocks();
    useDeviceSnapshotStore.getState().resetSnapshotState();
    useDeviceSnapshotStore.getState().upsertDevice(device);
  });

  it('Scenario: each received PLC value updates immediately without fetching a snapshot or inventing a version', () => {
    applyModbusRealtimeState(event);
    expect(useDeviceSnapshotStore.getState().devices[0]).toEqual({ ...device, lastKnownState: { value: 21 }, updatedAt: event.timestamp });
    applyModbusRealtimeState({ ...event, timestamp: '2026-10-04T12:00:02.000Z', payload: { ...event.payload, newState: { value: 22 } } });
    expect(useDeviceSnapshotStore.getState().devices[0].lastKnownState).toEqual({ value: 22 });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it.each([
    { ...event, payload: { ...event.payload, homeId: 'foreign-home' } },
    { ...event, payload: { ...event.payload, deviceId: 'unknown' } },
    { ...event, payload: { ...event.payload, newState: [] } },
    { ...event, timestamp: 'invalid' },
    { ...event, type: 'DeviceDiscoveredEvent' },
  ])('Scenario: unknown, foreign or malformed events cannot patch PLC state', (invalid) => {
    expect(isKnownModbusStateEvent(invalid)).toBe(false);
    applyModbusRealtimeState(invalid);
    expect(useDeviceSnapshotStore.getState().devices).toEqual([device]);
  });

  it('Scenario: stale events, non-PLC devices and a reset session are not overwritten or recreated', () => {
    applyModbusRealtimeState({ ...event, timestamp: device.updatedAt! });
    expect(useDeviceSnapshotStore.getState().devices).toEqual([device]);
    useDeviceSnapshotStore.getState().upsertDevice({ ...device, integrationSource: 'home-assistant' });
    expect(isKnownModbusStateEvent(event)).toBe(false);
    useDeviceSnapshotStore.getState().resetSnapshotState();
    applyModbusRealtimeState(event);
    expect(useDeviceSnapshotStore.getState().devices).toEqual([]);
  });

  it('Scenario: an in-flight old snapshot preserves newer PLC state while refreshing metadata', async () => {
    const response = deferred<Response>();
    mockApiFetch.mockImplementation((url: string) => url.endsWith('/devices') ? response.promise : Promise.resolve(jsonResponse([])));
    const refresh = useDeviceSnapshotStore.getState().refreshSnapshot({ force: true });
    applyModbusRealtimeState(event);
    response.resolve(jsonResponse([{ ...device, name: 'Renamed' }]));
    await refresh;
    expect(useDeviceSnapshotStore.getState().devices[0]).toEqual({ ...device, name: 'Renamed', lastKnownState: { value: 21 }, updatedAt: event.timestamp });
    mockApiFetch.mockResolvedValue(jsonResponse([]));
    await useDeviceSnapshotStore.getState().refreshSnapshot({ force: true });
    expect(useDeviceSnapshotStore.getState().devices).toEqual([]);
  });
});
