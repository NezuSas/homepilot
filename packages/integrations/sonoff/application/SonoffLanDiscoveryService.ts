import * as crypto from 'crypto';
import mdns from 'multicast-dns';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';

interface DnsRecord {
  type?: string;
  name?: string;
  data?: unknown;
}

export interface SonoffLanDiscoveryServiceDependencies {
  deviceRepository: DeviceRepository;
  homeRepository: HomeRepository;
}

export class SonoffLanDiscoveryService {
  private mdnsServer: mdns.MulticastDNS | null = null;
  private isScanning = false;
  private activeHomeId: string | null = null;
  private readonly discoveredDevices = new Set<string>();

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
    this.isScanning = false;
    this.discoveredDevices.clear();
    this.logInfo('[Sonoff Discovery] mDNS listener stopped');
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
        lastKnownState: { on: false },
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
