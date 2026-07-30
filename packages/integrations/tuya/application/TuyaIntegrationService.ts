import { randomUUID } from 'crypto';
import { Device } from '../../../devices/domain/types';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { TuyaAuthorization, TuyaAuthorizationSession, TuyaConnectionStatus } from '../domain/TuyaSettings';
import { TuyaSettingsRepository } from '../domain/TuyaSettingsRepository';
import { TuyaCloudClient, TuyaCloudDevice } from '../infrastructure/TuyaCloudClient';

export interface TuyaCoverCandidate {
  id: string;
  name: string;
  category: string;
  online: boolean;
}

export class TuyaIntegrationService {
  public constructor(
    private readonly repository: TuyaSettingsRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly clientId: string,
    private readonly authEndpoint = 'https://apigw.iotbing.com',
    private readonly schema = 'homepilotauthorize',
  ) {}

  public async getStatus(): Promise<TuyaConnectionStatus> {
    const authorization = await this.repository.getAuthorization();
    return {
      available: Boolean(this.clientId),
      configured: Boolean(authorization),
      userCodeHint: authorization ? this.mask(authorization.userCode) : '',
      updatedAt: authorization?.updatedAt || null,
    };
  }

  public async beginAuthorization(userCode: string): Promise<TuyaAuthorizationSession> {
    return this.client(null).createAuthorization(userCode);
  }

  public async completeAuthorization(userCode: string, qrToken: string): Promise<boolean> {
    const authorization = await this.client(null).completeAuthorization(userCode, qrToken);
    if (!authorization) return false;
    await this.repository.saveAuthorization(authorization);
    return true;
  }

  public async disconnect(): Promise<void> {
    await this.repository.clearAuthorization();
  }

  public async listCovers(): Promise<TuyaCoverCandidate[]> {
    const client = this.client(await this.requiredAuthorization());
    const devices = await client.listDevices();
    await this.persistAuthorization(client);
    return devices
      .filter((device) => this.isCover(device))
      .map((device) => ({ id: device.id, name: device.name || device.id, category: device.category || 'unknown', online: device.online === true }));
  }

  public async importCover(homeId: string, sourceId: string, name?: string): Promise<Device> {
    const client = this.client(await this.requiredAuthorization());
    const source = (await client.listDevices()).find((device) => device.id === sourceId);
    await this.persistAuthorization(client);
    if (!source || !this.isCover(source)) throw new Error('TUYA_COVER_NOT_FOUND');
    const externalId = `tuya:${source.id}`;
    if (await this.deviceRepository.findByExternalIdAndHomeId(externalId, homeId)) throw new Error('DEVICE_ALREADY_EXISTS');
    const now = new Date().toISOString();
    const position = this.position(source);
    const device: Device = {
      id: randomUUID(), homeId, roomId: null, externalId,
      name: name?.trim() || source.name || source.id,
      type: 'cover', semanticType: 'cover', vendor: 'Tuya', status: 'PENDING', integrationSource: 'tuya', invertState: false,
      capabilities: [{ type: 'cover', name: 'cover' }],
      lastKnownState: {
        state: position === 0 ? 'closed' : 'open',
        current_position: position,
        tuya: { controlCode: this.controlCode(source), positionCode: this.positionCode(source) },
      },
      entityVersion: 1, createdAt: now, updatedAt: now,
    };
    await this.deviceRepository.saveDevice(device);
    return device;
  }

  public async executeCoverCommand(device: Device, command: string, position?: number): Promise<void> {
    const sourceId = device.externalId.replace(/^tuya:/, '');
    if (!sourceId || sourceId === device.externalId) throw new Error('TUYA_DEVICE_ID_INVALID');
    const metadata = (device.lastKnownState || {}).tuya as { controlCode?: string; positionCode?: string } | undefined;
    const commands = command === 'set_position'
      ? [{ code: metadata?.positionCode || 'percent_control', value: position }]
      : [{ code: metadata?.controlCode || 'control', value: command === 'open' ? 'open' : command === 'close' ? 'close' : 'stop' }];
    const client = this.client(await this.requiredAuthorization());
    await client.sendCommands(sourceId, commands);
    await this.persistAuthorization(client);
  }

  private async requiredAuthorization(): Promise<TuyaAuthorization> {
    const value = await this.repository.getAuthorization();
    if (!value) throw new Error('TUYA_NOT_CONFIGURED');
    return value;
  }

  private client(authorization: TuyaAuthorization | null): TuyaCloudClient {
    if (!this.clientId) throw new Error('TUYA_CLIENT_NOT_CONFIGURED');
    return new TuyaCloudClient(this.clientId, authorization, this.authEndpoint, this.schema);
  }

  private async persistAuthorization(client: TuyaCloudClient): Promise<void> {
    const authorization = client.currentAuthorization();
    if (authorization) await this.repository.saveAuthorization(authorization);
  }

  private isCover(device: TuyaCloudDevice): boolean {
    const codes = new Set((device.functions || []).map((item) => item.code));
    return ['control', 'percent_control', 'control_back', 'switch'].some((code) => codes.has(code))
      && (codes.has('control') || codes.has('percent_control') || (device.category || '').startsWith('cl'));
  }

  private controlCode(device: TuyaCloudDevice): string {
    return (device.functions || []).some((item) => item.code === 'control') ? 'control' : 'control_back';
  }

  private positionCode(device: TuyaCloudDevice): string {
    return (device.functions || []).some((item) => item.code === 'percent_control') ? 'percent_control' : 'percent_state';
  }

  private position(device: TuyaCloudDevice): number {
    const item = (device.status || []).find((status) => status.code === 'percent_state' || status.code === 'percent_control');
    return typeof item?.value === 'number' ? Math.max(0, Math.min(100, item.value)) : 0;
  }

  private mask(value: string): string {
    return value.length <= 4 ? '••••' : `${value.slice(0, 2)}••••${value.slice(-2)}`;
  }
}
