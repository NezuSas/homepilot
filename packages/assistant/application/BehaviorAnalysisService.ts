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
  metadata: Record<string, unknown>;
}

export class BehaviorAnalysisService {
  constructor(
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly contextService: ContextAnalysisService,
    private readonly getTimezone: () => Promise<string> = async () => Intl.DateTimeFormat().resolvedOptions().timeZone
  ) {}

  public async analyzeProactively(homeId: string): Promise<BehaviorFinding[]> {
    const findings: BehaviorFinding[] = [];
    
    // 1. Detect Habits (4+ local days, same time window)
    const habitFindings = await this.detectHabits(homeId);
    findings.push(...habitFindings);

    // 2. Detect Energy Waste (> 8h usage without motion) - Tightened from 6h
    const wasteFindings = await this.detectEnergyWaste();
    findings.push(...wasteFindings);

    // 3. Detect Low Usage (> 21 days inactive) - Tightened from 14h
    const lowUsageFindings = await this.detectLowUsage();
    findings.push(...lowUsageFindings);

    return findings;
  }

  private async detectHabits(homeId: string): Promise<BehaviorFinding[]> {
    const timezone = await this.getTimezone();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const localParts = (timestamp: string) => {
      const date = new Date(timestamp);
      if (!Number.isFinite(date.getTime())) return null;
      const parts = formatter.formatToParts(date);
      const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
      return { day: `${part('year')}-${part('month')}-${part('day')}`, minutes: Number(part('hour')) * 60 + Number(part('minute')) };
    };
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const logs = await this.activityLogRepository.findAllByTypes(['COMMAND_DISPATCHED'], since.toISOString());

    const deviceActions: Record<string, ActivityRecord[]> = {};
    for (const log of logs) {
      if (!log.deviceId || log.type !== 'COMMAND_DISPATCHED' || !localParts(log.timestamp)) continue;
      // Automatic executions are not evidence of a user's manual routine.
      if (log.data?.ruleId || log.data?.automationId || log.data?.isAutomation === true || log.data?.sourceType === 'automation' || log.data?.source === 'automation') continue;
      const key = `${log.deviceId}:${log.description}`;
      if (!deviceActions[key]) deviceActions[key] = [];
      deviceActions[key].push(log);
    }

    const findings: BehaviorFinding[] = [];

    for (const [key, actions] of Object.entries(deviceActions)) {
      const [deviceId] = key.split(':');
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device || device.homeId !== homeId || !device.roomId) continue;

      // Group by day to check if it occurs on 4+ distinct days (Tightened from 3)
      const days = new Set(actions.map(a => localParts(a.timestamp)!.day));
      if (days.size < 4) continue;

      // Check for time alignment (+/- 30 mins)
      const timeBuckets: Record<string, Set<string>> = {};
      for (const action of actions) {
        const { minutes, day } = localParts(action.timestamp)!;
        const bucket = Math.floor(minutes / 30);
        (timeBuckets[bucket] ??= new Set()).add(day);
      }

      for (const [bucket, bucketDays] of Object.entries(timeBuckets)) {
        if (bucketDays.size >= 4) {
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
            metadata: { timeWindow: timeStr, timezone, action: actions[0].description, occurrences: actions.filter(a => Math.floor(localParts(a.timestamp)!.minutes / 30) === Number(bucket)).length, days: bucketDays.size }
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
      
      const state = device.lastKnownState as { on?: boolean } | null;
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
