import { EnergyAnalysisService } from '../application/EnergyAnalysisService';
import { Device } from '../../devices/domain/types';

function device(overrides: Partial<Device>): Device {
  return {
    id: 'device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.living', name: 'Living light', type: 'light', vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: { on: false }, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-17T12:00:00.000Z', ...overrides,
  };
}

describe('EnergyAnalysisService', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-17T12:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  function createService(devices: readonly Device[], optimizationDevices: Array<{ deviceId: string; deviceName: string; type: string }> = []) {
    const deviceRepository = {
      findAll: jest.fn().mockResolvedValue(devices),
      findDeviceById: jest.fn().mockImplementation(async (id: string) => devices.find((item) => item.id === id) ?? null),
    };
    const contextService = {
      analyzeContext: jest.fn().mockResolvedValue({ insights: { potentialOptimizations: optimizationDevices } }),
    };
    return { service: new EnergyAnalysisService({} as never, deviceRepository as never, contextService as never), deviceRepository, contextService };
  }

  it('reports long-running eligible devices and high-power spikes', async () => {
    const { service } = createService([
      device({ id: 'long-light', updatedAt: '2026-08-17T03:00:00.000Z', lastKnownState: { on: true } }),
      device({ id: 'measured-switch', type: 'switch', updatedAt: '2026-08-17T03:00:00.000Z', lastKnownState: { power: 2500 } }),
      device({ id: 'fresh-light', updatedAt: '2026-08-17T05:00:00.000Z', lastKnownState: { on: true } }),
      device({ id: 'sensor', type: 'sensor', updatedAt: '2026-08-17T03:00:00.000Z', lastKnownState: { power: 3000 } }),
    ]);

    const findings = await service.analyzeProactively('home-1');

    expect(findings).toContainEqual(expect.objectContaining({ type: 'long_running_device', deviceId: 'long-light', metadata: expect.objectContaining({ powerUsage: 10, hoursOn: 9, estimatedConsumption: '0.09' }) }));
    expect(findings).toContainEqual(expect.objectContaining({ type: 'long_running_device', deviceId: 'measured-switch', metadata: expect.objectContaining({ powerUsage: 2500, estimatedConsumption: '22.50' }) }));
    expect(findings).toContainEqual(expect.objectContaining({ type: 'high_consumption_pattern', deviceId: 'measured-switch', metadata: expect.objectContaining({ powerUsage: '2500' }) }));
    expect(findings).toContainEqual(expect.objectContaining({ type: 'high_consumption_pattern', deviceId: 'sensor' }));
    expect(findings.filter((item) => item.deviceId === 'fresh-light' && item.type === 'long_running_device')).toEqual([]);
  });

  it('reports only resolvable empty-room devices supplied by context analysis', async () => {
    const active = device({ id: 'active', name: 'Desk lamp', updatedAt: '2026-08-17T10:00:00.000Z', lastKnownState: { power: 35 } });
    const { service, contextService } = createService([active], [
      { deviceId: 'active', deviceName: 'Desk lamp', type: 'empty_room_device_on' },
      { deviceId: 'active', deviceName: 'Desk lamp', type: 'always_on' },
      { deviceId: 'missing', deviceName: 'Missing', type: 'empty_room_device_on' },
    ]);

    const findings = await service.analyzeProactively('home-1');

    expect(contextService.analyzeContext).toHaveBeenCalledWith('home-1');
    expect(findings.filter((item) => item.type === 'energy_waste_detected')).toEqual([
      expect.objectContaining({ deviceId: 'active', reasonKey: 'empty_room_active', metadata: expect.objectContaining({ powerUsage: 35, hoursOn: '2.0' }) }),
    ]);
  });

  it('returns no findings for inactive, low-power, or unsupported devices', async () => {
    const { service } = createService([
      device({ id: 'off', lastKnownState: { on: false } }),
      device({ id: 'unsupported', type: 'cover', lastKnownState: { on: true, power: 200 } }),
      device({ id: 'low-power', type: 'sensor', lastKnownState: { power: 1500 } }),
    ]);

    await expect(service.analyzeProactively('home-1')).resolves.toEqual([]);
  });
});