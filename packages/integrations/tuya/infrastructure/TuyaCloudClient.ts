import { createHash, createHmac } from 'crypto';
import { TuyaSettings } from '../domain/TuyaSettings';

export interface TuyaDeviceFunction {
  code: string;
  values?: string;
}

export interface TuyaCloudDevice {
  id: string;
  name: string;
  category?: string;
  product_name?: string;
  online?: boolean;
  functions?: TuyaDeviceFunction[];
  status?: Array<{ code: string; value: unknown }>;
}

interface TuyaApiResponse<T> {
  success: boolean;
  result?: T;
  code?: number;
  msg?: string;
}

export class TuyaCloudClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly settings: Omit<TuyaSettings, 'updatedAt'>) {}

  public async testConnection(): Promise<void> {
    await this.getAccessToken();
    await this.listDevices();
  }

  public async listDevices(): Promise<TuyaCloudDevice[]> {
    const result = await this.request<TuyaCloudDevice[]>(`/v1.0/users/${encodeURIComponent(this.settings.userUid)}/devices`, 'GET');
    return Array.isArray(result) ? result : [];
  }

  public async sendCommands(deviceId: string, commands: Array<{ code: string; value: unknown }>): Promise<void> {
    await this.request(`/v1.0/devices/${encodeURIComponent(deviceId)}/commands`, 'POST', { commands });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return this.accessToken;
    const result = await this.request<{ access_token: string; expire_time?: number }>('/v1.0/token?grant_type=1', 'GET', undefined, false);
    if (!result?.access_token) throw new Error('TUYA_AUTH_FAILED');
    this.accessToken = result.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(60, result.expire_time || 3600) * 1000;
    return this.accessToken;
  }

  private async request<T>(path: string, method: 'GET' | 'POST', body?: unknown, needsToken = true): Promise<T> {
    const token = needsToken ? await this.getAccessToken() : '';
    const timestamp = Date.now().toString();
    const payload = body === undefined ? '' : JSON.stringify(body);
    const contentHash = createHash('sha256').update(payload).digest('hex');
    const stringToSign = `${method}\n${contentHash}\n\n${path}`;
    const signPayload = `${this.settings.clientId}${token}${timestamp}${stringToSign}`;
    const signature = createHmac('sha256', this.settings.clientSecret).update(signPayload).digest('hex').toUpperCase();
    const response = await fetch(`${this.settings.endpoint}${path}`, {
      method,
      headers: {
        client_id: this.settings.clientId,
        sign: signature,
        t: timestamp,
        sign_method: 'HMAC-SHA256',
        ...(token ? { access_token: token } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: payload }),
    });
    if (!response.ok) throw new Error(`TUYA_HTTP_${response.status}`);
    const data = await response.json() as TuyaApiResponse<T>;
    if (!data.success) throw new Error(data.msg || `TUYA_API_${data.code || 'FAILED'}`);
    return data.result as T;
  }
}