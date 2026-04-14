import { ActivityLogRepository, ActivityRecord } from '../../devices/domain/repositories/ActivityLogRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ContextAnalysisService } from './ContextAnalysisService';

export interface BehaviorFinding {
  type: 'habit' | 'waste' | 'low_usage';
  deviceId: string;
  deviceName: string;
  roomId: string | null;
  reasonKey: string;
  confidence: number;
  metadata: Record<string, any>;
}

export class BehaviorAnalysisService {
  constructor(
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly contextService: ContextAnalysisService
  ) {}

  public async analyzeProactively(homeId: string): Promise<BehaviorFinding[]> {
    const findings: BehaviorFinding[] = [];
    
    // 1. Detect Habits (3+ days, same time window)
    const habitFindings = await this.detectHabits();
    findings.push(...habitFindings);

    // 2. Detect Energy Waste (> 8h usage without motion) - Tightened from 6h
    const wasteFindings = await this.detectEnergyWaste();
    findings.push(...wasteFindings);

    // 3. Detect Low Usage (> 21 days inactive) - Tightened from 14h
    const lowUsageFindings = await this.detectLowUsage();
    findings.push(...lowUsageFindings);

    return findings;
  }

  private async detectHabits(): Promise<BehaviorFinding[]> {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const logs = await this.activityLogRepository.findAllByTypes(['COMMAND_DISPATCHED', 'STATE_CHANGED'], since.toISOString());

    const deviceActions: Record<string, ActivityRecord[]> = {};
    for (const log of logs) {
      if (!log.deviceId) continue;
      const key = `${log.deviceId}:${log.description}`;
      if (!deviceActions[key]) deviceActions[key] = [];
      deviceActions[key].push(log);
    }

    const findings: BehaviorFinding[] = [];

    for (const [key, actions] of Object.entries(deviceActions)) {
      const [deviceId] = key.split(':');
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) continue;

      // Group by day to check if it occurs on 4+ distinct days (Tightened from 3)
      const days = new Set(actions.map(a => a.timestamp.split('T')[0]));
      if (days.size < 4) continue;

      // Check for time alignment (+/- 30 mins)
      const timeBuckets: Record<string, number> = {};
      for (const action of actions) {
        const date = new Date(action.timestamp);
        const minutes = date.getHours() * 60 + date.getMinutes();
        const bucket = Math.floor(minutes / 30);
        timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
      }

      for (const [bucket, count] of Object.entries(timeBuckets)) {
        if (count >= 3) {
          const hour = Math.floor(Number(bucket) * 30 / 60);
          const min = (Number(bucket) * 30) % 60;
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          
          findings.push({
            type: 'habit',
            deviceId,
            deviceName: device.name,
            roomId: device.roomId,
            reasonKey: 'repeated_control_time',
            confidence: 0.85,
            metadata: { timeWindow: timeStr, action: actions[0].description, occurrences: count, days: days.size }
          });
          break; 
        }
      }
    }

    return findings;
  }

  private async detectEnergyWaste(): Promise<BehaviorFinding[]> {
    // Logic: Active devices (lights) ON for > 8 hours 
    const devices = await this.deviceRepository.findAll();
    const findings: BehaviorFinding[] = [];
    const now = new Date();

    for (const device of devices) {
      if (device.type !== 'light' && device.type !== 'switch') continue;
      
      const state = device.lastKnownState as any;
      if (state?.on !== true) continue;

      const updated = new Date(device.updatedAt);
      const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);

      // Tightened threshold: 8 hours
      if (diffHours > 8) {
        findings.push({
          type: 'waste',
          deviceId: device.id,
          deviceName: device.name,
          roomId: device.roomId,
          reasonKey: 'long_duration_on',
          confidence: 0.75,
          metadata: { hoursOn: Math.floor(diffHours) }
        });
      }
    }

    return findings;
  }

  private async detectLowUsage(): Promise<BehaviorFinding[]> {
    const since = new Date();
    since.setDate(since.getDate() - 21); // Tightened from 14 days
    
    const devices = await this.deviceRepository.findAll();
    const findings: BehaviorFinding[] = [];

    for (const device of devices) {
      if (!device.roomId) continue; // Only care about installed devices
      
      const updated = new Date(device.updatedAt);
      if (updated < since) {
        findings.push({
          type: 'low_usage',
          deviceId: device.id,
          deviceName: device.name,
          roomId: device.roomId,
          reasonKey: 'no_activity_long_term',
          confidence: 0.65,
          metadata: { daysInactive: 21, lastActive: device.updatedAt }
        });
      }
    }

    return findings;
  }
}
