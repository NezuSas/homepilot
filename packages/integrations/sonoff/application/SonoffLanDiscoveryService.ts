import * as crypto from 'crypto';
import mdns from 'multicast-dns';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../../devices/application/syncDeviceStateUseCase';

interface DnsRecord {
  type?: string;
  name?: string;
  data?: unknown;
}

export interface SonoffLanDiscoveryServiceDependencies {
  deviceRepository: DeviceRepository;
  homeRepository: HomeRepository;
  syncDeps?: SyncDeviceStateDependencies;
}

export class SonoffConnectionRegistry {
  private static readonly connections = new Map<string, { ip: string, lastSeen: number }>();

  static registerIp(externalIdMatch: string, ip: string): void {
    this.connections.set(externalIdMatch, { ip, lastSeen: Date.now() });
  }

  static getIp(externalIdMatch: string): string | null {
    return this.connections.get(externalIdMatch)?.ip || null;
  }

  static getAllConnections(): Array<[string, { ip: string, lastSeen: number }]> {
    return Array.from(this.connections.entries());
  }
}

export class SonoffLanDiscoveryService {
  private mdnsServer: mdns.MulticastDNS | null = null;
  private isScanning = false;
  private activeHomeId: string | null = null;
  private readonly discoveredDevices = new Set<string>();
  private pollingTimer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: SonoffLanDiscoveryServiceDependencies) {}

  private logInfo(message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'test') {
      data ? console.log(message, data) : console.log(message);
    }
  }

  private logError(message: string, error?: unknown): void {
    if (process.env.NODE_ENV !== 'test') {
      error ? console.error(message, error) : console.error(message);
    }
  }

  public startDiscovery(homeId?: string): void {
    if (this.isScanning) return;
    this.isScanning = true;
    
    if (homeId) {
      this.activeHomeId = homeId;
    }
    
    this.mdnsServer = mdns();
    
    // Start lightweight polling if syncDeps is provided
    if (this.deps.syncDeps) {
      this.pollingTimer = setInterval(() => this.pollStates(), 30000);
      this.pollingTimer.unref?.();
    }

    // We only care about Sonoff devices (_ewelink._tcp.local)
    this.mdnsServer?.on('response', async (response: mdns.ResponsePacket) => {
      try {
        const answers = response.answers || [];
        const additions = response.additionals || [];
        const records = [...answers, ...additions];
        
        for (const record of records) {
          if (record.type === 'SRV' && record.name && record.name.includes('_ewelink._tcp.local')) {
            const externalIdMatch = record.name.replace('._ewelink._tcp.local', '');
            await this.processDiscoveredDevice(externalIdMatch, records);
          }
        }
      } catch (error) {
        // Safe fail
        this.logError('[Sonoff Discovery] Error processing mDNS response:', error);
      }
    });

    this.logInfo('[Sonoff Discovery] mDNS listener started for _ewelink._tcp.local');
    
    // Send initial query
    this.mdnsServer?.query({
      questions: [{
        name: '_ewelink._tcp.local',
        type: 'PTR'
      }]
    });
  }

  public stopDiscovery(): void {
    if (this.mdnsServer) {
      this.mdnsServer?.destroy();
      this.mdnsServer = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isScanning = false;
    this.discoveredDevices.clear();
    this.logInfo('[Sonoff Discovery] mDNS listener stopped');
  }

  private async pollStates(): Promise<void> {
    if (!this.deps.syncDeps) return;

    for (const [externalIdMatch, { ip }] of SonoffConnectionRegistry.getAllConnections()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const url = `http://${ip}:8081/zeroconf/info`;
        const res = await fetch(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            deviceid: externalIdMatch.replace('eWeLink_', ''), 
            data: {} 
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const infoBody = await res.json();
        const reportedSwitch = infoBody?.data?.switch;
        
        if (typeof reportedSwitch === 'string') {
          const externalId = `sonoff:${externalIdMatch}`;
          const device = await this.deps.deviceRepository.findByExternalId(externalId);
          if (!device) continue;

          const currentStateOn = reportedSwitch === 'on';
          const newState = { 
            ...device.lastKnownState, 
            on: currentStateOn, 
            state: currentStateOn ? 'on' : 'off' 
          };

          // Compare logic to avoid spamming the event bus if state hasn't changed
          const wasOn = device.lastKnownState?.on === true || device.lastKnownState?.state === 'on';
          if (wasOn !== currentStateOn) {
            await syncDeviceStateUseCase(device.id, newState, 'sonoff-lan-poll', this.deps.syncDeps);
            this.logInfo(`[Sonoff Sync] Estado actualizado via Polling para ${externalIdMatch}: ${reportedSwitch}`);
          }
        }
      } catch (e) {
        // Silent generic catch for network unavailability during aggressive polling
      }
    }
  }

  private async getTargetHomeId(): Promise<string | null> {
    if (this.activeHomeId) return this.activeHomeId;
    
    // Safely attempt to fetch system homes using standard domain boundaries
    const systemHomes = await this.deps.homeRepository.findHomesByUserId('system');
    if (systemHomes.length > 0) return systemHomes[0].id;
    
    return null;
  }

  private async processDiscoveredDevice(externalIdMatch: string, records: DnsRecord[]): Promise<void> {
    const externalId = `sonoff:${externalIdMatch}`;

    if (this.discoveredDevices.has(externalId)) return;
    this.discoveredDevices.add(externalId);

    try {
      const targetHomeId = await this.getTargetHomeId();
      if (!targetHomeId) return;

      const existing = await this.deps.deviceRepository.findByExternalIdAndHomeId(externalId, targetHomeId);
      if (existing) return;

      // Extract device type/info if available from TXT
      let deviceType: 'light' | 'switch' | 'sensor' | 'cover' = 'switch';
      let defaultName = `Sonoff Device (${externalIdMatch})`;
      
      const aRecord = records.find(r => r.type === 'A' && typeof r.name === 'string' && r.name.includes(externalIdMatch));
      const resolvedIp = typeof aRecord?.data === 'string' ? aRecord.data : null;

      if (resolvedIp) {
        SonoffConnectionRegistry.registerIp(externalIdMatch, resolvedIp);
      }

      const txtRecord = records.find(r => r.type === 'TXT' && typeof r.name === 'string' && r.name.includes(externalIdMatch));
      if (txtRecord && Array.isArray(txtRecord.data)) {
         const txtString = txtRecord.data.map((b: Buffer) => b.toString('utf8')).join('');
         if (txtString.includes('type=plug') || txtString.includes('type=switch')) {
            deviceType = 'switch';
         } else if (txtString.includes('type=light')) {
            deviceType = 'light';
         }
      }

      const deviceId = crypto.randomUUID();
      const now = new Date().toISOString();

      const device = {
        id: deviceId,
        homeId: targetHomeId,
        roomId: null, // Push to Inbox (unassigned room)
        externalId: externalId,
        name: defaultName,
        type: deviceType,
        vendor: 'Sonoff',
        status: 'PENDING' as const,
        integrationSource: 'sonoff' as const,
        invertState: false,
        lastKnownState: { 
          on: false,
          ip: resolvedIp
        },
        entityVersion: 1,
        createdAt: now,
        updatedAt: now
      };

      await this.deps.deviceRepository.saveDevice(device);
      this.logInfo(`[Sonoff Discovery] Device pushed to Inbox: ${externalId}`);
    } catch (e) {
       // Ignore duplicate insertion collisions cleanly
       this.discoveredDevices.delete(externalId);
       this.logError(`[Sonoff Discovery] Could not push device:`, (e as Error).message);
    }
  }
}
