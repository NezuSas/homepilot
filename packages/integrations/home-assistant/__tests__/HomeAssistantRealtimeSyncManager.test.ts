import { Device } from '../../../devices/domain/types';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantClient } from '../../../devices/infrastructure/adapters/HomeAssistantClient';
import { HomeAssistantRealtimeSyncManager } from '../application/HomeAssistantRealtimeSyncManager';
import { HomeAssistantSettingsService } from '../application/HomeAssistantSettingsService';

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

describe('HomeAssistantRealtimeSyncManager reconciliation', () => {
  it('marks missing entities unavailable and restores them when they reappear', async () => {
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
      { getAllStates } as unknown as HomeAssistantClient,
    );
    const runReconciliation = () => (
      manager as unknown as { _runReconciliation(): Promise<void> }
    )._runReconciliation();

    await runReconciliation();

    expect(devices.find((device) => device.id === 'missing-cover')?.lastKnownState).toEqual({
      state: 'unavailable',
      availabilityReason: 'entity_missing',
    });

    await runReconciliation();

    expect(devices.find((device) => device.id === 'missing-cover')?.lastKnownState).toEqual({
      state: 'closed',
      attributes: { current_position: 0 },
    });
  });
});
