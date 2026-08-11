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
});
