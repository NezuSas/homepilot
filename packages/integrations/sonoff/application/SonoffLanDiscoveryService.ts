import * as crypto from 'crypto';
import mdns from 'multicast-dns';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../../devices/application/syncDeviceStateUseCase';
import { logRuntimeDiagnostic } from '../../../shared/config/runtimeEnvironment';

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
  private static readonly failureCounts = new Map<string, number>();

  /** Consecutive failed poll probes (~30s apart) before a device is marked unavailable. */
  static readonly UNAVAILABLE_THRESHOLD = 3;

  static registerIp(externalIdMatch: string, ip: string): void {
    this.connections.set(externalIdMatch, { ip, lastSeen: Date.now() });
    this.failureCounts.delete(externalIdMatch);
  }

  static getIp(externalIdMatch: string): string | null {
    return this.connections.get(externalIdMatch)?.ip || null;
  }

  static getAllConnections(): Array<[string, { ip: string, lastSeen: number }]> {
    return Array.from(this.connections.entries());
  }

  /** Returns the new consecutive-failure count after recording one more failed probe. */
  static recordPollFailure(externalIdMatch: string): number {
    const next = (this.failureCounts.get(externalIdMatch) ?? 0) + 1;
    this.failureCounts.set(externalIdMatch, next);
    return next;
  }

  static resetPollFailures(externalIdMatch: string): void {
    this.failureCounts.delete(externalIdMatch);
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
    if (data !== undefined) {
      logRuntimeDiagnostic('log', message, data);
      return;
    }

    logRuntimeDiagnostic('log', message);
  }

  private logError(message: string, error?: unknown): void {
    if (error !== undefined) {
      logRuntimeDiagnostic('error', message, error);
      return;
    }

    logRuntimeDiagnostic('error', message);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
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

        // The fetch itself succeeded (no thrown network error), so the device is
        // reachable on the LAN even if it returned a non-OK response — reset the
        // failure streak that would otherwise mark it unavailable.
        SonoffConnectionRegistry.resetPollFailures(externalIdMatch);

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

          // Compare logic to avoid spamming the event bus if state hasn't changed.
          // A device previously marked unavailable always needs the sync, even if
          // its on/off value happens to match what it was before going offline —
          // otherwise `state: 'unavailable'` would never get cleared.
          const wasOn = device.lastKnownState?.on === true || device.lastKnownState?.state === 'on';
          const wasMarkedUnavailable = device.lastKnownState?.state === 'unavailable';
          if (wasOn !== currentStateOn || wasMarkedUnavailable) {
            await syncDeviceStateUseCase(device.id, newState, 'sonoff-lan-poll', this.deps.syncDeps);
            this.logInfo(`[Sonoff Sync] Estado actualizado via Polling para ${externalIdMatch}: ${reportedSwitch}`);
          }
        }
      } catch (e) {
        // Network-level failure (timeout, connection refused, DHCP IP change, etc.):
        // after a few consecutive misses, mark the device unavailable so bulk
        // assistant actions ("apaga todo") stop trying to reach a device that
        // consistently doesn't answer, instead of failing loudly every time.
        const failureCount = SonoffConnectionRegistry.recordPollFailure(externalIdMatch);
        if (failureCount >= SonoffConnectionRegistry.UNAVAILABLE_THRESHOLD) {
          await this.markUnreachable(externalIdMatch);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  private async markUnreachable(externalIdMatch: string): Promise<void> {
    if (!this.deps.syncDeps) return;
    const externalId = `sonoff:${externalIdMatch}`;
    const device = await this.deps.deviceRepository.findByExternalId(externalId);
    if (!device || device.lastKnownState?.state === 'unavailable') return;

    const newState = { ...device.lastKnownState, state: 'unavailable' };
    await syncDeviceStateUseCase(device.id, newState, 'sonoff-lan-poll', this.deps.syncDeps);
    this.logInfo(`[Sonoff Sync] Dispositivo marcado no disponible tras fallos consecutivos: ${externalIdMatch}`);
  }

  private async getTargetHomeId(): Promise<string | null> {
    if (this.activeHomeId) return this.activeHomeId;
    
    // 1. Try system-owned homes
    const systemHomes = await this.deps.homeRepository.findHomesByUserId('system');
    if (systemHomes.length > 0) return systemHomes[0].id;

    // 2. Fallback: Any existing home (useful for single-tenant hardware appliances)
    const allHomes = await this.deps.homeRepository.findAll();
    if (allHomes.length > 0) return allHomes[0].id;
    
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
      let uiid = '';
      let isPlug = false;

      const aRecord = records.find(r => r.type === 'A' && typeof r.name === 'string' && r.name.includes(externalIdMatch));
      const resolvedIp = typeof aRecord?.data === 'string' ? aRecord.data : null;

      if (resolvedIp) {
        SonoffConnectionRegistry.registerIp(externalIdMatch, resolvedIp);
      }

      const txtRecord = records.find(r => r.type === 'TXT' && typeof r.name === 'string' && r.name.includes(externalIdMatch));
      if (txtRecord && Array.isArray(txtRecord.data)) {
         for (const item of txtRecord.data) {
            const str = item.toString('utf8');
            if (str.startsWith('uiid=')) {
               uiid = str.split('=')[1];
            }
            if (str.startsWith('type=')) {
               const val = str.split('=')[1];
               if (val === 'plug') isPlug = true;
               if (val === 'plug' || val === 'switch') {
                  deviceType = 'switch';
               } else if (val === 'light') {
                  deviceType = 'light';
               }
            }
         }
      }

      const uiidInt = parseInt(uiid, 10);
      let friendlyType = 'Dispositivo';
      if (isPlug) {
         friendlyType = 'Tomacorriente';
      } else if (uiidInt === 1 || uiidInt === 138 || uiidInt === 15) {
         friendlyType = 'Interruptor';
      } else if (uiidInt === 2 || uiidInt === 6 || uiidInt === 7 || uiidInt === 8) {
         friendlyType = 'Interruptor Múltiple';
      } else if (uiidInt === 4) {
         friendlyType = 'Interruptor 4CH';
      } else if (deviceType === 'switch') {
         friendlyType = 'Interruptor';
      } else if (deviceType === 'light') {
         friendlyType = 'Luz';
      }

      const shortId = externalIdMatch.replace('eWeLink_', '').slice(-6).toUpperCase();
      const defaultName = `${friendlyType} Sonoff (${shortId})`;

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
