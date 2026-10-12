import { syncDeviceStateUseCase } from '../application/syncDeviceStateUseCase';
import { recordsStateChange } from '../domain/activityPolicy';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import type { Clock, IdGenerator } from '../../shared/domain/types';

const idGenerator: IdGenerator = { generate: () => 'event-1' };
const clock: Clock = { now: () => '2026-10-12T10:00:00.000Z' };

describe('Feature: the activity log keeps meaningful changes, not telemetry noise', () => {
  it.each([
    ['sensor', false],
    ['SENSOR', false],
    [' sensor ', false],
    ['binary_sensor', true],
    ['switch', true],
    ['light', true],
    ['cover', true],
    ['media_player', true],
    ['camera', true],
  ])('Scenario: Given a %s device When deciding whether to record its state change Then the answer is %s', (type, expected) => {
    expect(recordsStateChange(type)).toBe(expected);
  });

  async function syncState(type: string) {
    const devices = new InMemoryDeviceRepository();
    const logs = new InMemoryActivityLogRepository();
    const device = createDiscoveredDevice({ homeId: 'home-1', externalId: `ext-${type}`, name: type, type, vendor: 'test' }, { idGenerator, clock });
    await devices.saveDevice(device);

    await syncDeviceStateUseCase(device.id, { state: '42' }, 'corr-1', {
      deviceRepository: devices, eventPublisher: new InMemoryDeviceEventPublisher(), activityLogRepository: logs, idGenerator, clock,
    });

    return { logs: await logs.findRecentByDeviceId(device.id, 10), stored: await devices.findDeviceById(device.id) };
  }

  it('Scenario: Given a numeric sensor When its state is synchronized Then the device state updates and no activity row is written', async () => {
    const { logs, stored } = await syncState('sensor');

    expect(stored?.lastKnownState).toEqual({ state: '42' });
    expect(logs).toEqual([]);
  });

  it.each(['switch', 'binary_sensor'])('Scenario: Given a %s When its state is synchronized Then the change is recorded', async (type) => {
    const { logs } = await syncState(type);

    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('STATE_CHANGED');
  });
});
