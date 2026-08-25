import { EventEmitter } from 'events';
import { Device } from '../../../devices/domain/types';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantRealtimeSocket, HomeAssistantRealtimeSyncManager } from '../application/HomeAssistantRealtimeSyncManager';
import { HomeAssistantSettingsService } from '../application/HomeAssistantSettingsService';
import { HomeAssistantStateReader } from '../application/ports/HomeAssistantStateReader';

const createDevice = (id: string, entityId: string): Device => ({
  id,
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: `ha:${entityId}`,
  name: id,
  type: 'cover',
  semanticType: 'cover',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: { state: 'open' },
  entityVersion: 1,
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
});

class FakeRealtimeSocket extends EventEmitter {
  public readonly connect = jest.fn().mockResolvedValue(undefined);
  public readonly forceClose = jest.fn();
}

function asRealtimeSocket(socket: FakeRealtimeSocket): HomeAssistantRealtimeSocket {
  return socket as unknown as HomeAssistantRealtimeSocket;
}
describe('Feature: Home Assistant resilience and reconciliation', () => {
  it('Scenario: Given a reconnection reconciliation When remote state changes Then local state is silently restored', async () => {
    let devices = [
      createDevice('missing-cover', 'cover.old_master'),
      createDevice('live-cover', 'cover.master'),
    ];
    const saveDevice = jest.fn(async (updated: Device) => {
      devices = devices.map((device) => device.id === updated.id ? updated : device);
    });
    const deviceRepository = {
      findAll: jest.fn(async () => devices),
      saveDevice,
    } as unknown as DeviceRepository;
    const activityLogRepository = {
      saveActivity: jest.fn().mockResolvedValue(undefined),
    } as unknown as ActivityLogRepository;
    const getAllStates = jest.fn()
      .mockResolvedValueOnce([{
        entity_id: 'cover.master',
        state: 'open',
        attributes: { current_position: 100 },
      }])
      .mockResolvedValueOnce([
        {
          entity_id: 'cover.old_master',
          state: 'closed',
          attributes: { current_position: 0 },
        },
        {
          entity_id: 'cover.master',
          state: 'open',
          attributes: { current_position: 100 },
        },
      ]);
    const manager = new HomeAssistantRealtimeSyncManager(
      {} as HomeAssistantSettingsService,
      deviceRepository,
      activityLogRepository,
      { getAllStates } satisfies HomeAssistantStateReader,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);
    const runReconciliation = () => (
      manager as unknown as { _runReconciliation(): Promise<void> }
    )._runReconciliation();

    await runReconciliation();
    expect(systemEvent).not.toHaveBeenCalled();

    expect(devices.find((device) => device.id === 'missing-cover')?.lastKnownState).toEqual({
      state: 'unavailable',
      availabilityReason: 'entity_missing',
    });

    await runReconciliation();
    expect(systemEvent).not.toHaveBeenCalled();

    expect(devices.find((device) => device.id === 'missing-cover')?.lastKnownState).toEqual({
      state: 'closed',
      attributes: { current_position: 0 },
    });
  });

  it('keeps the WebSocket event listener active when reconciliation fails', async () => {
    const getAllStates = jest.fn().mockRejectedValue('network unavailable');
    const socket = new FakeRealtimeSocket();
    const findByExternalId = jest.fn().mockResolvedValue(null);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      { getAllStates } satisfies HomeAssistantStateReader,
      () => asRealtimeSocket(socket),
    );

    manager.reconnect('http://ha:8123', 'token');
    socket.emit('ready');
    await new Promise<void>((resolve) => setImmediate(resolve));
    socket.emit('event', { entity_id: 'light.unlinked', new_state: { state: 'on', attributes: {} } });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(getAllStates).toHaveBeenCalledTimes(1);
    expect(findByExternalId).toHaveBeenCalledWith('ha:light.unlinked');
    expect(manager.getObservableState().reconciliationStatus).toBe('idle');
    manager.stop();
  });
  it('uses one retry timer and cancels it on reconfiguration', () => {
    jest.useFakeTimers();
    const firstSocket = new FakeRealtimeSocket();
    const secondSocket = new FakeRealtimeSocket();
    const socketFactory = jest.fn()
      .mockReturnValueOnce(asRealtimeSocket(firstSocket))
      .mockReturnValueOnce(asRealtimeSocket(secondSocket));
    const settingsService = { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService;
    const manager = new HomeAssistantRealtimeSyncManager(
      settingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha-one:8123', 'token-one');
      firstSocket.emit('ready');
      firstSocket.emit('close');
      expect(manager.getObservableState().websocketStatus).toBe('reconnecting');

      manager.reconnect('http://ha-two:8123', 'token-two');
      jest.advanceTimersByTime(1000);

      expect(socketFactory).toHaveBeenCalledTimes(2);
      expect(socketFactory).toHaveBeenLastCalledWith('http://ha-two:8123', 'token-two');
      expect(settingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('retries a network drop after the first V2 backoff delay', () => {
    jest.useFakeTimers();
    const firstSocket = new FakeRealtimeSocket();
    const retrySocket = new FakeRealtimeSocket();
    const socketFactory = jest.fn()
      .mockReturnValueOnce(asRealtimeSocket(firstSocket))
      .mockReturnValueOnce(asRealtimeSocket(retrySocket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha:8123', 'token');
      firstSocket.emit('ready');
      firstSocket.emit('close');
      jest.advanceTimersByTime(999);
      expect(socketFactory).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(socketFactory).toHaveBeenCalledTimes(2);
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('retries an unreachable transport error even when the socket does not emit close', () => {
    jest.useFakeTimers();
    const failedSocket = new FakeRealtimeSocket();
    const retrySocket = new FakeRealtimeSocket();
    const socketFactory = jest.fn()
      .mockReturnValueOnce(asRealtimeSocket(failedSocket))
      .mockReturnValueOnce(asRealtimeSocket(retrySocket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha:8123', 'token');
      failedSocket.emit('error', 'unreachable', new Error('connection refused'));

      expect(manager.getObservableState().websocketStatus).toBe('reconnecting');
      jest.advanceTimersByTime(1000);
      expect(socketFactory).toHaveBeenCalledTimes(2);

      retrySocket.emit('ready');
      failedSocket.emit('close');
      jest.advanceTimersByTime(10000);
      expect(socketFactory).toHaveBeenCalledTimes(2);
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });
  it('does not retry after a fatal authentication error', () => {
    jest.useFakeTimers();
    const socket = new FakeRealtimeSocket();
    const socketFactory = jest.fn().mockReturnValue(asRealtimeSocket(socket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha:8123', 'invalid-token');
      socket.emit('error', 'auth_error', new Error('invalid token'));
      jest.advanceTimersByTime(10000);
      expect(socketFactory).toHaveBeenCalledTimes(1);
      expect(manager.getObservableState().websocketStatus).toBe('stopped');
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });
  it('synchronizes a valid mapped event and publishes an auditable system event', async () => {
    const device = createDevice('living-room-light', 'light.living_room');
    const findByExternalId = jest.fn().mockResolvedValue(device);
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const saveActivity = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId, saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.living_room',
      new_state: { state: 'on', attributes: { brightness: 180 } },
    });

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      id: device.id,
      lastKnownState: { state: 'on', attributes: { brightness: 180 } },
    }));
    expect(systemEvent).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: device.id,
      externalId: 'ha:light.living_room',
      previousState: { state: 'open', attributes: undefined },
      newState: { state: 'on', attributes: { brightness: 180 } },
    }));
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: device.id,
      type: 'STATE_CHANGED',
    }));
  });

  it('ignores a duplicate realtime snapshot even when Home Assistant changes attribute key order', async () => {
    const device: Device = {
      ...createDevice('living-room-light', 'light.living_room'),
      lastKnownState: {
        state: 'on',
        attributes: { brightness: 180, color_mode: 'rgb' },
      },
    };
    const findByExternalId = jest.fn().mockResolvedValue(device);
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const saveActivity = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId, saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.living_room',
      new_state: { state: 'on', attributes: { color_mode: 'rgb', brightness: 180 } },
    });

    expect(saveDevice).not.toHaveBeenCalled();
    expect(systemEvent).not.toHaveBeenCalled();
    expect(saveActivity).not.toHaveBeenCalled();
  });
  it('keeps an attribute-only realtime change observable and auditable', async () => {
    const device: Device = {
      ...createDevice('living-room-light', 'light.living_room'),
      lastKnownState: { state: 'on', attributes: { brightness: 180 } },
    };
    const findByExternalId = jest.fn().mockResolvedValue(device);
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const saveActivity = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId, saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.living_room',
      new_state: { state: 'on', attributes: { brightness: 181 } },
    });

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      lastKnownState: { state: 'on', attributes: { brightness: 181 } },
    }));
    expect(systemEvent).toHaveBeenCalledTimes(1);
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'STATE_CHANGED' }));
  });
  it('ignores malformed events without mutating local devices', async () => {
    const findByExternalId = jest.fn();
    const saveDevice = jest.fn();
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId, saveDevice } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
    );

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.invalid',
      new_state: null,
    });

    expect(findByExternalId).not.toHaveBeenCalled();
    expect(saveDevice).not.toHaveBeenCalled();
  });

  it('prevents overlapping reconciliations while the remote state request is pending', async () => {
    let resolveStates: ((states: Array<{ entity_id: string; state: string; attributes: Record<string, unknown> }>) => void) | undefined;
    const getAllStates = jest.fn(() => new Promise<Array<{ entity_id: string; state: string; attributes: Record<string, unknown> }>>((resolve) => {
      resolveStates = resolve;
    }));
    const manager = new HomeAssistantRealtimeSyncManager(
      {} as HomeAssistantSettingsService,
      { findAll: jest.fn().mockResolvedValue([]) } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      { getAllStates } satisfies HomeAssistantStateReader,
    );
    const runReconciliation = () => (
      manager as unknown as { _runReconciliation(): Promise<void> }
    )._runReconciliation();

    const firstRun = runReconciliation();
    const secondRun = runReconciliation();
    expect(manager.getObservableState().reconciliationStatus).toBe('running');
    expect(getAllStates).toHaveBeenCalledTimes(1);

    resolveStates?.([]);
    await Promise.all([firstRun, secondRun]);
    expect(manager.getObservableState().reconciliationStatus).toBe('idle');
  });
  it('reports the live socket as connected until an explicit stop releases it', () => {
    const socket = new FakeRealtimeSocket();
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      () => asRealtimeSocket(socket),
    );

    manager.reconnect('http://ha:8123', 'token');

    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(manager.getObservableState()).toEqual(expect.objectContaining({ websocketStatus: 'connected' }));

    manager.stop();

    expect(socket.forceClose).toHaveBeenCalledTimes(1);
    expect(manager.getObservableState()).toEqual(expect.objectContaining({ websocketStatus: 'stopped' }));
  });
  it('stops cleanly and does not open a socket when credentials are absent', () => {
    const socket = new FakeRealtimeSocket();
    const socketFactory = jest.fn().mockReturnValue(asRealtimeSocket(socket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    manager.reconnect('', 'token');
    manager.reconnect('http://ha:8123', '');
    expect(socketFactory).not.toHaveBeenCalled();

    manager.reconnect('http://ha:8123', 'token');
    manager.stop();

    expect(socket.forceClose).toHaveBeenCalledTimes(1);
    expect(manager.getObservableState().websocketStatus).toBe('stopped');
  });

  it('contains persistence and audit failures from a valid realtime event', async () => {
    const device = createDevice('faulty-light', 'light.faulty');
    const saveDevice = jest.fn().mockRejectedValue(new Error('database locked'));
    const saveActivity = jest.fn().mockRejectedValue(new Error('audit unavailable'));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId: jest.fn().mockResolvedValue(device), saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );

    await expect((manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.faulty', new_state: { state: 'on', attributes: {} },
    })).resolves.toBeUndefined();
    expect(saveDevice).toHaveBeenCalledTimes(1);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it('keeps a pre-existing unavailable entity untouched during reconciliation', async () => {
    const unavailableDevice = { ...createDevice('offline-light', 'light.offline'), lastKnownState: { state: 'unavailable' } };
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      {} as HomeAssistantSettingsService,
      { findAll: jest.fn().mockResolvedValue([unavailableDevice]), saveDevice } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      { getAllStates: jest.fn().mockResolvedValue([]) } satisfies HomeAssistantStateReader,
    );

    await (manager as unknown as { _runReconciliation(): Promise<void> })._runReconciliation();

    expect(saveDevice).not.toHaveBeenCalled();
    expect(manager.getObservableState().reconciliationStatus).toBe('idle');
  });
  it('keeps the socket alive when an unreachable signal precedes its close event', () => {
    jest.useFakeTimers();
    const socket = new FakeRealtimeSocket();
    const settingsService = { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService;
    const manager = new HomeAssistantRealtimeSyncManager(
      settingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      () => asRealtimeSocket(socket),
    );

    try {
      manager.reconnect('http://ha:8123', 'token');
      socket.emit('error', 'unreachable', new Error('network unavailable'));
      expect(settingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');
      expect(socket.forceClose).not.toHaveBeenCalled();
      socket.emit('close');
      expect(manager.getObservableState().websocketStatus).toBe('reconnecting');
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('does not persist or audit an event for an entity that is not mapped locally', async () => {
    const findByExternalId = jest.fn().mockResolvedValue(null);
    const saveDevice = jest.fn();
    const saveActivity = jest.fn();
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId, saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.not_imported',
      new_state: { state: 'on' },
    });

    expect(findByExternalId).toHaveBeenCalledWith('ha:light.not_imported');
    expect(saveDevice).not.toHaveBeenCalled();
    expect(saveActivity).not.toHaveBeenCalled();
  });
  it('continues reconciling remaining Home Assistant devices when one local save fails', async () => {
    const failingDevice = createDevice('failing-light', 'light.failing');
    const healthyDevice = createDevice('healthy-light', 'light.healthy');
    const nonHaDevice = { ...createDevice('native-sensor', 'sensor.native'), integrationSource: 'native' as const };
    const saveDevice = jest.fn(async (updated: Device) => {
      if (updated.id === failingDevice.id) {
        throw new Error('database locked');
      }
    });
    const saveActivity = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      {} as HomeAssistantSettingsService,
      { findAll: jest.fn().mockResolvedValue([failingDevice, healthyDevice, nonHaDevice]), saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
      {
        getAllStates: jest.fn().mockResolvedValue([
          { entity_id: 'light.failing', state: 'on', attributes: {} },
          { entity_id: 'light.healthy', state: 'off', attributes: { brightness: 1 } },
        ]),
      } satisfies HomeAssistantStateReader,
    );

    await (manager as unknown as { _runReconciliation(): Promise<void> })._runReconciliation();

    expect(saveDevice).toHaveBeenCalledTimes(2);
    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      id: healthyDevice.id,
      lastKnownState: { state: 'off', attributes: { brightness: 1 } },
    }));
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'HA_RESILIENCE',
      data: expect.objectContaining({ reconciledDevices: 1, skippedDevices: 1 }),
    }));
    expect(manager.getObservableState().reconciliationStatus).toBe('idle');
  });

  it('keeps a synchronized state change successful when its audit log cannot be stored', async () => {
    const device = createDevice('audited-light', 'light.audited');
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const saveActivity = jest.fn().mockRejectedValue(new Error('audit unavailable'));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId: jest.fn().mockResolvedValue(device), saveDevice } as unknown as DeviceRepository,
      { saveActivity } as unknown as ActivityLogRepository,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);

    await expect((manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'light.audited',
      new_state: { state: 'on', attributes: {} },
    })).resolves.toBeUndefined();

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({ id: device.id }));
    expect(systemEvent).toHaveBeenCalledWith(expect.objectContaining({ deviceId: device.id }));
    expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'STATE_CHANGED' }));
  });
  it('does not stack reconnect timers when the transport emits duplicate close notifications', () => {
    jest.useFakeTimers();
    const firstSocket = new FakeRealtimeSocket();
    const retrySocket = new FakeRealtimeSocket();
    const socketFactory = jest.fn()
      .mockReturnValueOnce(asRealtimeSocket(firstSocket))
      .mockReturnValueOnce(asRealtimeSocket(retrySocket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha:8123', 'token');
      firstSocket.emit('ready');
      firstSocket.emit('close');
      firstSocket.emit('close');

      jest.advanceTimersByTime(1000);
      expect(socketFactory).toHaveBeenCalledTimes(2);
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('normalizes an event without attribute metadata before persisting it', async () => {
    const device = createDevice('numeric-sensor', 'sensor.temperature');
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId: jest.fn().mockResolvedValue(device), saveDevice } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
    );

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'sensor.temperature',
      new_state: { state: 23, attributes: 'invalid' },
    });

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      lastKnownState: { state: '23', attributes: {} },
    }));
  });

  it('leaves reconciliation idle when no state reader is configured', async () => {
    const findAll = jest.fn();
    const manager = new HomeAssistantRealtimeSyncManager(
      {} as HomeAssistantSettingsService,
      { findAll } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
    );

    await (manager as unknown as { _runReconciliation(): Promise<void> })._runReconciliation();

    expect(findAll).not.toHaveBeenCalled();
    expect(manager.getObservableState()).toEqual(expect.objectContaining({ reconciliationStatus: 'idle' }));
  });

  it('cancels an already scheduled retry when a later authentication failure is received', () => {
    jest.useFakeTimers();
    const socket = new FakeRealtimeSocket();
    const socketFactory = jest.fn().mockReturnValue(asRealtimeSocket(socket));
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      socketFactory,
    );

    try {
      manager.reconnect('http://ha:8123', 'expired-token');
      socket.emit('ready');
      socket.emit('close');
      socket.emit('error', 'auth_error', new Error('token rejected'));
      jest.advanceTimersByTime(10000);

      expect(socketFactory).toHaveBeenCalledTimes(1);
      expect(manager.getObservableState().websocketStatus).toBe('stopped');
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('contains a rejected socket connection after its error event was handled', async () => {
    const socket = new FakeRealtimeSocket();
    socket.connect.mockRejectedValue(new Error('network unavailable'));
    const settingsService = { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService;
    const manager = new HomeAssistantRealtimeSyncManager(
      settingsService,
      {} as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      () => asRealtimeSocket(socket),
    );

    manager.reconnect('http://ha:8123', 'token');
    socket.emit('error', 'unreachable', new Error('network unavailable'));
    await Promise.resolve();

    expect(settingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');
    manager.stop();
  });

  it('records an event without a previous state as an initial observed state', async () => {
    const device = { ...createDevice('new-sensor', 'sensor.new'), lastKnownState: null };
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService,
      { findByExternalId: jest.fn().mockResolvedValue(device), saveDevice } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
    );
    const systemEvent = jest.fn();
    manager.on('system_event', systemEvent);

    await (manager as unknown as { processEvent(data: unknown): Promise<void> }).processEvent({
      entity_id: 'sensor.new', new_state: { state: 'ready', attributes: {} },
    });

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({ lastKnownState: { state: 'ready', attributes: {} } }));
    expect(systemEvent).toHaveBeenCalledWith(expect.objectContaining({ previousState: undefined }));
  });

  it('processes a transport event through the live socket listener and preserves reachability', async () => {
    const socket = new FakeRealtimeSocket();
    const settingsService = { updateStatusFromOperation: jest.fn() } as unknown as HomeAssistantSettingsService;
    const device = createDevice('socket-light', 'light.socket');
    const saveDevice = jest.fn().mockResolvedValue(undefined);
    const manager = new HomeAssistantRealtimeSyncManager(
      settingsService,
      { findByExternalId: jest.fn().mockResolvedValue(device), saveDevice } as unknown as DeviceRepository,
      { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as ActivityLogRepository,
      null,
      () => asRealtimeSocket(socket),
    );

    manager.reconnect('http://ha:8123', 'token');
    socket.emit('event', { entity_id: 'light.socket', new_state: { state: 'on', attributes: {} } });
    await Promise.resolve();
    await Promise.resolve();

    expect(settingsService.updateStatusFromOperation).toHaveBeenCalledWith('reachable');
    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      id: device.id,
      lastKnownState: { state: 'on', attributes: {} },
    }));
    manager.stop();
  });
});
