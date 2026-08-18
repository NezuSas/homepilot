import { BehaviorAnalysisService } from '../application/BehaviorAnalysisService';
import { Device } from '../../devices/domain/types';
import { ActivityRecord } from '../../devices/domain/repositories/ActivityLogRepository';

function device(overrides: Partial<Device>): Device {
  return {
    id: 'device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.living', name: 'Living light', type: 'light', vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: { on: false }, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-17T12:00:00.000Z', ...overrides,
  };
}

function activity(deviceId: string | null, timestamp: string, description = 'Turned on'): ActivityRecord {
  return { deviceId, timestamp, type: 'COMMAND_DISPATCHED', description, data: {} };
}

describe('BehaviorAnalysisService', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-17T12:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  function createService(logs: readonly ActivityRecord[], devices: readonly Device[], knownDevice: Device | null = devices[0] ?? null) {
    const activityLogRepository = { findAllByTypes: jest.fn().mockResolvedValue(logs) };
    const deviceRepository = {
      findAll: jest.fn().mockResolvedValue(devices),
      findDeviceById: jest.fn().mockResolvedValue(knownDevice),
    };
    return {
      service: new BehaviorAnalysisService(activityLogRepository as never, deviceRepository as never, {} as never),
      activityLogRepository,
      deviceRepository,
    };
  }

  it('finds a repeated same-window habit across four distinct days', async () => {
    const target = device({ id: 'light-1', name: 'Hall light' });
    const logs = [
      activity('light-1', '2026-08-10T19:05:00.000Z'),
      activity('light-1', '2026-08-11T19:15:00.000Z'),
      activity('light-1', '2026-08-12T19:20:00.000Z'),
      activity('light-1', '2026-08-13T19:25:00.000Z'),
      activity(null, '2026-08-13T19:25:00.000Z'),
    ];
    const { service, activityLogRepository } = createService(logs, [target]);

    const findings = await service.analyzeProactively('home-1');

    expect(activityLogRepository.findAllByTypes).toHaveBeenCalledWith(['COMMAND_DISPATCHED', 'STATE_CHANGED'], expect.any(String));
    expect(findings).toContainEqual(expect.objectContaining({
      type: 'habit', deviceId: 'light-1', deviceName: 'Hall light', reasonKey: 'repeated_control_time', confidence: 0.85,
      metadata: expect.objectContaining({ occurrences: 4, days: 4, action: 'Turned on' }),
    }));
  });

  it('ignores habits without enough days, unknown devices, or aligned events', async () => {
    const target = device({ id: 'light-1' });
    const logs = [
      activity('light-1', '2026-08-10T19:05:00.000Z'),
      activity('light-1', '2026-08-11T19:35:00.000Z'),
      activity('light-1', '2026-08-12T20:05:00.000Z'),
      activity('light-1', '2026-08-13T20:35:00.000Z'),
    ];
    const { service, deviceRepository } = createService(logs, [target], null);

    const findings = await service.analyzeProactively('home-1');

    expect(deviceRepository.findDeviceById).toHaveBeenCalledWith('light-1');
    expect(findings.filter((item) => item.type === 'habit')).toEqual([]);
  });

  it('detects only eligible lights and switches that remain on beyond eight hours', async () => {
    const old = '2026-08-17T03:00:00.000Z';
    const { service } = createService([], [
      device({ id: 'old-light', updatedAt: old, lastKnownState: { on: true } }),
      device({ id: 'old-switch', type: 'switch', updatedAt: old, lastKnownState: { on: true } }),
      device({ id: 'fresh-light', updatedAt: '2026-08-17T05:00:00.000Z', lastKnownState: { on: true } }),
      device({ id: 'off-light', updatedAt: old, lastKnownState: { on: false } }),
      device({ id: 'sensor', type: 'sensor', updatedAt: old, lastKnownState: { on: true } }),
    ]);

    const findings = await service.analyzeProactively('home-1');

    expect(findings.filter((item) => item.type === 'waste')).toEqual([
      expect.objectContaining({ deviceId: 'old-light', reasonKey: 'long_duration_on', metadata: { hoursOn: 9 } }),
      expect.objectContaining({ deviceId: 'old-switch', reasonKey: 'long_duration_on', metadata: { hoursOn: 9 } }),
    ]);
  });

  it('detects installed devices inactive for more than twenty-one days', async () => {
    const { service } = createService([], [
      device({ id: 'inactive', updatedAt: '2026-07-20T12:00:00.000Z' }),
      device({ id: 'recent', updatedAt: '2026-08-01T12:00:00.000Z' }),
      device({ id: 'unassigned', roomId: null, updatedAt: '2026-07-20T12:00:00.000Z' }),
    ]);

    const findings = await service.analyzeProactively('home-1');

    expect(findings.filter((item) => item.type === 'low_usage')).toEqual([
      expect.objectContaining({ deviceId: 'inactive', reasonKey: 'no_activity_long_term', metadata: { daysInactive: 21, lastActive: '2026-07-20T12:00:00.000Z' } }),
    ]);
  });
});