import { randomUUID } from 'crypto';
import { Device } from '../../../devices/domain/types';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { TuyaConnectionStatus, TuyaSettings } from '../domain/TuyaSettings';
import { TuyaSettingsRepository } from '../domain/TuyaSettingsRepository';
import { TuyaCloudClient, TuyaCloudDevice } from '../infrastructure/TuyaCloudClient';

export interface TuyaCoverCandidate {
  id: string;
  name: string;
  category: string;
  online: boolean;
}

export interface TuyaSettingsInput {
  endpoint: string;
  clientId: string;
  clientSecret?: string;
  userUid: string;
}

export class TuyaIntegrationService {
  constructor(private readonly repository: TuyaSettingsRepository, private readonly deviceRepository: DeviceRepository) {}

  public async getStatus(): Promise<TuyaConnectionStatus> {
    const settings = await this.repository.getSettings();
    return settings ? {
      configured: true,
      endpoint: settings.endpoint,
      clientIdHint: this.mask(settings.clientId),
      userUidHint: this.mask(settings.userUid),
      updatedAt: settings.updatedAt,
    } : { configured: false, endpoint: '', clientIdHint: '', userUidHint: '', updatedAt: null };
  }

  public async test(settings: Omit<TuyaSettings, 'updatedAt'>): Promise<void> {
    await this.client(this.normalize(settings)).testConnection();
  }

  public async save(settings: Omit<TuyaSettings, 'updatedAt'>): Promise<void> {
    const normalized = this.normalize(settings);
    await this.repository.saveSettings({ ...normalized, updatedAt: new Date().toISOString() });
  }

  public async listCovers(): Promise<TuyaCoverCandidate[]> {
    const settings = await this.requiredSettings();
    const devices = await this.client(settings).listDevices();
    return devices.filter((device) => this.isCover(device)).map((device) => ({
      id: device.id,
      name: device.name || device.id,
      category: device.category || 'unknown',
      online: device.online === true,
    }));
  }

  public async importCover(homeId: string, sourceId: string, name?: string): Promise<Device> {
    const settings = await this.requiredSettings();
    const source = (await this.client(settings).listDevices()).find((device) => device.id === sourceId);
    if (!source || !this.isCover(source)) throw new Error('TUYA_COVER_NOT_FOUND');
    const externalId = `tuya:${source.id}`;
    const existing = await this.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);
    if (existing) throw new Error('DEVICE_ALREADY_EXISTS');
    const now = new Date().toISOString();
    const position = this.position(source);
    const device: Device = {
      id: randomUUID(), homeId, roomId: null, externalId,
      name: name?.trim() || source.name || source.id,
      type: 'cover', semanticType: 'cover', vendor: 'Tuya', status: 'PENDING', integrationSource: 'tuya', invertState: false,
      capabilities: [{ type: 'cover', name: 'cover' }],
      lastKnownState: { state: position === 0 ? 'closed' : 'open', current_position: position, tuya: { controlCode: this.controlCode(source), positionCode: this.positionCode(source) } },
      entityVersion: 1, createdAt: now, updatedAt: now,
    };
    await this.deviceRepository.saveDevice(device);
    return device;
  }

  public async executeCoverCommand(device: Device, command: string, position?: number): Promise<void> {
    const sourceId = device.externalId.replace(/^tuya:/, '');
    if (!sourceId || sourceId === device.externalId) throw new Error('TUYA_DEVICE_ID_INVALID');
    const state = device.lastKnownState || {};
    const metadata = state.tuya as { controlCode?: string; positionCode?: string } | undefined;
    const controlCode = metadata?.controlCode || 'control';
    const positionCode = metadata?.positionCode || 'percent_control';
    const commands = command === 'set_position'
      ? [{ code: positionCode, value: position }]
      : [{ code: controlCode, value: command === 'open' ? 'open' : command === 'close' ? 'close' : 'stop' }];
    await this.client(await this.requiredSettings()).sendCommands(sourceId, commands);
  }

  private async requiredSettings(): Promise<TuyaSettings> {
    const settings = await this.repository.getSettings();
    if (!settings) throw new Error('TUYA_NOT_CONFIGURED');
    return settings;
  }

  private client(settings: Omit<TuyaSettings, 'updatedAt'>): TuyaCloudClient { return new TuyaCloudClient(settings); }

  private async resolveSettings(settings: TuyaSettingsInput): Promise<Omit<TuyaSettings, 'updatedAt'>> {
    const current = await this.repository.getSettings();
    return this.normalize({
      endpoint: settings.endpoint,
      clientId: settings.clientId,
      clientSecret: settings.clientSecret?.trim() || current?.clientSecret || '',
      userUid: settings.userUid,
    });
  }

  private normalize(settings: Omit<TuyaSettings, 'updatedAt'>): Omit<TuyaSettings, 'updatedAt'> {
    const endpoint = settings.endpoint.trim().replace(/\/$/, '');
    if (!endpoint || !settings.clientId.trim() || !settings.clientSecret.trim() || !settings.userUid.trim()) throw new Error('TUYA_SETTINGS_INVALID');
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') throw new Error('TUYA_ENDPOINT_HTTPS_REQUIRED');
    return { endpoint, clientId: settings.clientId.trim(), clientSecret: settings.clientSecret.trim(), userUid: settings.userUid.trim() };
  }

  private isCover(device: TuyaCloudDevice): boolean {
    const codes = new Set((device.functions || []).map((item) => item.code));
    return ['control', 'percent_control', 'control_back', 'switch'].some((code) => codes.has(code))
      && (codes.has('control') || codes.has('percent_control') || (device.category || '').startsWith('cl'));
  }

  private controlCode(device: TuyaCloudDevice): string { return (device.functions || []).some((item) => item.code === 'control') ? 'control' : 'control_back'; }
  private positionCode(device: TuyaCloudDevice): string { return (device.functions || []).some((item) => item.code === 'percent_control') ? 'percent_control' : 'percent_state'; }
  private position(device: TuyaCloudDevice): number {
    const item = (device.status || []).find((status) => status.code === 'percent_state' || status.code === 'percent_control');
    return typeof item?.value === 'number' ? Math.max(0, Math.min(100, item.value)) : 0;
  }
  private mask(value: string): string { return value.length <= 6 ? '••••••' : `${value.slice(0, 3)}••••${value.slice(-3)}`; }
}