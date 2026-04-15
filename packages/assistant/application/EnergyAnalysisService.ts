import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ContextAnalysisService } from './ContextAnalysisService';

export interface EnergyFinding {
  type: 'energy_waste_detected' | 'high_consumption_pattern' | 'long_running_device';
  deviceId: string;
  deviceName: string;
  roomId: string | null;
  reasonKey: string;
  confidence: number;
  metadata: Record<string, any>;
}

export class EnergyAnalysisService {
  constructor(
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly contextService: ContextAnalysisService
  ) {}

  public async analyzeProactively(homeId: string): Promise<EnergyFinding[]> {
    const findings: EnergyFinding[] = [];
    
    // 1. Detect Devices Left ON too long (> 4h)
    const longRunning = await this.detectLongRunningDevices();
    findings.push(...longRunning);

    // 2. Detect Energy Waste (simulated based on no motion context)
    const waste = await this.detectEnergyWaste(homeId);
    findings.push(...waste);

    // 3. Detect High Consumption (Simulated spike analysis)
    const highConsumption = await this.detectHighConsumption();
    findings.push(...highConsumption);

    return findings;
  }

  private async detectLongRunningDevices(): Promise<EnergyFinding[]> {
    const devices = await this.deviceRepository.findAll();
    const findings: EnergyFinding[] = [];
    const now = new Date();

    for (const device of devices) {
      if (device.type !== 'light' && device.type !== 'switch') continue;
      
      const state = device.lastKnownState as any;
      // Also look for power reading if available, else fallback to state
      const powerUsage = state?.power ? Number(state.power) : (state?.on ? 10 : 0); // fallback est W
      if (state?.on !== true && powerUsage <= 0) continue;

      const updated = new Date(device.updatedAt);
      const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);

      // Tightened threshold: 8 hours instead of 4
      if (diffHours > 8) {
        const estimatedConsumption = (powerUsage * diffHours) / 1000; // kWh
        findings.push({
          type: 'long_running_device',
          deviceId: device.id,
          deviceName: device.name,
          roomId: device.roomId,
          reasonKey: 'long_duration_on',
          confidence: 0.85,
          metadata: { 
            hoursOn: Math.floor(diffHours),
            powerUsage,
            estimatedConsumption: estimatedConsumption.toFixed(2),
            lastActiveAt: device.updatedAt,
            displayTitle: 'Long Running Device',
            displayDescription: `${device.name} has been running for ${Math.floor(diffHours)} hours`
          }
        });
      }
    }
    return findings;
  }

  private async detectEnergyWaste(homeId: string): Promise<EnergyFinding[]> {
    // Rely on context service to find empty rooms where lights are on
    const context = await this.contextService.analyzeContext(homeId);
    const findings: EnergyFinding[] = [];
    const now = new Date();

    for (const insight of context.insights.potentialOptimizations) {
      if (insight.type === 'empty_room_device_on') {
        const device = await this.deviceRepository.findDeviceById(insight.deviceId);
        if (!device) continue;
        
        const state = device.lastKnownState as any;
        const powerUsage = state?.power ? Number(state.power) : 10;
        const diffHours = (now.getTime() - new Date(device.updatedAt).getTime()) / 3600000;
        
        findings.push({
          type: 'energy_waste_detected',
          deviceId: insight.deviceId,
          deviceName: insight.deviceName,
          roomId: device.roomId,
          reasonKey: 'empty_room_active',
          confidence: 0.90,
          metadata: {
            powerUsage,
            hoursOn: diffHours > 0 ? diffHours.toFixed(1) : '<1',
            displayTitle: 'Energy Waste Detected',
            displayDescription: `${insight.deviceName} is on but the room appears unoccupied`
          }
        });
      }
    }
    return findings;
  }

  private async detectHighConsumption(): Promise<EnergyFinding[]> {
    const devices = await this.deviceRepository.findAll();
    const findings: EnergyFinding[] = [];

    for (const device of devices) {
      const state = device.lastKnownState as any;
      const powerUsage = state?.power ? Number(state.power) : 0;
      
      // Spike detection: e.g. > 1500W
      if (powerUsage > 1500) {
        findings.push({
          type: 'high_consumption_pattern',
          deviceId: device.id,
          deviceName: device.name,
          roomId: device.roomId,
          reasonKey: 'power_spike',
          confidence: 0.95,
          metadata: {
            powerUsage: powerUsage.toFixed(0),
            displayTitle: 'High Consumption Pattern',
            displayDescription: `${device.name} is drawing unusually high power (${powerUsage.toFixed(0)}W)`
          }
        });
      }
    }
    return findings;
  }
}
