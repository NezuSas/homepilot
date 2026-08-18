import { ContextAnalysisService } from '../application/ContextAnalysisService';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';

const room: Room = { id: 'room-1', homeId: 'home-1', name: 'Living room', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', entityVersion: 1 };

function device(overrides: Partial<Device>): Device {
  return {
    id: 'device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.living_room', name: 'Living light', type: 'light', vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: { state: 'off' }, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

describe('ContextAnalysisService', () => {
  it('maps rooms, domains, inbox devices, and actionable context signals', async () => {
    const devices = [
      device({ id: 'light-1' }),
      device({ id: 'motion-1', externalId: 'ha:binary_sensor.living_motion', name: 'Living motion sensor', type: 'sensor' }),
      device({ id: 'cover-1', externalId: 'ha:cover.living_blind', type: 'cover' }),
      device({ id: 'inbox-1', roomId: null, status: 'PENDING', externalId: 'local-device', type: 'switch' }),
    ];
    const deviceRepository = { findAllByHomeId: jest.fn().mockResolvedValue(devices) };
    const roomRepository = { findRoomsByHomeId: jest.fn().mockResolvedValue([room]) };
    const service = new ContextAnalysisService(deviceRepository as never, roomRepository as never);

    const result = await service.analyzeContext('home-1');

    expect(deviceRepository.findAllByHomeId).toHaveBeenCalledWith('home-1');
    expect(result.deviceStats).toEqual({ total: 4, byDomain: { light: 1, binary_sensor: 1, cover: 1, switch: 1 }, inbox: 1 });
    expect(result.unassignedDevices.map((item) => item.id)).toEqual(['inbox-1']);
    expect(result.rooms[0]).toEqual(expect.objectContaining({ room, domains: ['light', 'binary_sensor', 'cover'] }));
    expect(result.insights.motionLightPairs[0]).toEqual(expect.objectContaining({ roomId: 'room-1', sensors: [devices[1]], lights: [devices[0]] }));
    expect(result.insights.lightCoverPairs[0]).toEqual(expect.objectContaining({ roomId: 'room-1', lights: [devices[0]], covers: [devices[2]] }));
    expect(result.insights.potentialOptimizations).toEqual([]);
  });

  it('does not infer motion or room insights from unrelated or unassigned devices', async () => {
    const devices = [
      device({ id: 'sensor-1', externalId: 'ha:sensor.temperature', name: 'Temperature', type: 'sensor' }),
      device({ id: 'no-state', lastKnownState: null, roomId: null }),
    ];
    const service = new ContextAnalysisService(
      { findAllByHomeId: jest.fn().mockResolvedValue(devices) } as never,
      { findRoomsByHomeId: jest.fn().mockResolvedValue([room]) } as never,
    );

    const result = await service.analyzeContext('home-1');

    expect(result.insights.motionLightPairs).toEqual([]);
    expect(result.insights.lightCoverPairs).toEqual([]);
    expect(result.insights.potentialOptimizations).toEqual([]);
  });
});