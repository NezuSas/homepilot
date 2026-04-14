import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';

export interface SystemContext {
  homeId: string;
  rooms: {
    room: Room;
    devices: Device[];
    domains: string[];
  }[];
  unassignedDevices: Device[];
  deviceStats: {
    total: number;
    byDomain: Record<string, number>;
    inbox: number;
  };
  insights: {
    motionLightPairs: { roomId: string; roomName: string; sensors: Device[]; lights: Device[] }[];
    lightCoverPairs: { roomId: string; roomName: string; lights: Device[]; covers: Device[] }[];
    potentialOptimizations: { deviceId: string; deviceName: string; type: string; reason: string }[];
  };
}

export class ContextAnalysisService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository
  ) {}

  public async analyzeContext(homeId: string): Promise<SystemContext> {
    const allDevices = await this.deviceRepository.findAllByHomeId(homeId);
    const rooms = await this.roomRepository.findRoomsByHomeId(homeId);

    const context: SystemContext = {
      homeId,
      rooms: [],
      unassignedDevices: [],
      deviceStats: {
        total: allDevices.length,
        byDomain: {},
        inbox: 0
      },
      insights: {
        motionLightPairs: [],
        lightCoverPairs: [],
        potentialOptimizations: []
      }
    };

    // 1. Basic Stats & Unassigned
    for (const d of allDevices) {
      const domain = this.getDomain(d);
      context.deviceStats.byDomain[domain] = (context.deviceStats.byDomain[domain] || 0) + 1;
      
      if (!d.roomId || d.status === 'PENDING') {
        context.unassignedDevices.push(d);
        context.deviceStats.inbox++;
      }
    }

    // 2. Room Mapping
    for (const room of rooms) {
      const roomDevices = allDevices.filter(d => d.roomId === room.id);
      const roomDomains = Array.from(new Set(roomDevices.map(d => this.getDomain(d))));
      
      context.rooms.push({
        room,
        devices: roomDevices,
        domains: roomDomains
      });

      // 3. Insight: Motion + Light
      const sensors = roomDevices.filter(d => this.isMotionSensor(d));
      const lights = roomDevices.filter(d => this.getDomain(d) === 'light');
      
      if (sensors.length > 0 && lights.length > 0) {
        context.insights.motionLightPairs.push({
          roomId: room.id,
          roomName: room.name,
          sensors,
          lights
        });
      }

      // 4. Insight: Light + Cover
      const covers = roomDevices.filter(d => this.getDomain(d) === 'cover');
      if (lights.length > 0 && covers.length > 0) {
        context.insights.lightCoverPairs.push({
          roomId: room.id,
          roomName: room.name,
          lights,
          covers
        });
      }
    }

    // 5. Always-ON detection (deterministic signal)
    // For now, if a device has been ON in lastKnownState for a while (no hist here, but let's check current)
    // Or if it's a type that usually shouldn't be always on.
    for (const d of allDevices) {
      if (this.isAlwaysOnCandidate(d)) {
        context.insights.potentialOptimizations.push({
          deviceId: d.id,
          deviceName: d.name,
          type: 'always_on',
          reason: 'device_permanently_on'
        });
      }
    }

    return context;
  }

  private getDomain(device: Device): string {
    if (device.externalId.includes(':')) {
      return device.externalId.split(':')[1].split('.')[0];
    }
    return device.type || 'unknown';
  }

  private isMotionSensor(device: Device): boolean {
    const domain = this.getDomain(device);
    if (domain === 'binary_sensor' || domain === 'sensor') {
      const name = device.name.toLowerCase();
      const eid = device.externalId.toLowerCase();
      return name.includes('motion') || name.includes('movimiento') || name.includes('presence') ||
             eid.includes('motion') || eid.includes('occupancy');
    }
    return false;
  }

  private isAlwaysOnCandidate(device: Device): boolean {
    // If state is 'on' and it's been a while? 
    // Without activity history, we rely on current state + type.
    const state = device.lastKnownState;
    if (!state) return false;
    
    const domain = this.getDomain(device);
    if (['light', 'switch'].includes(domain)) {
      // If it's on, we could suggest checking it, but user said "strong contextual signals".
      // Maybe I'll wait for real usage data or just keep it empty for now to avoid spam.
      return false; 
    }
    return false;
  }
}
