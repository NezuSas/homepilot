import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';
import { TuyaAuthorization, TuyaAuthorizationSession } from '../domain/TuyaSettings';

export interface TuyaCloudDevice {
  id: string;
  name: string;
  category?: string;
  online?: boolean;
  functions?: Array<{ code: string; values?: string }>;
  status?: Array<{ code: string; value: unknown }>;
}

interface TuyaApiResponse<T> {
  success: boolean;
  result?: T;
  t?: number;
  code?: number;
  msg?: string;
}

interface TuyaLoginResult {
  uid: string;
  terminal_id: string;
  endpoint: string;
  access_token: string;
  refresh_token: string;
  expire_time: number;
}

export class TuyaCloudClient {
  public constructor(
    private readonly clientId: string,
    private authorization: TuyaAuthorization | null,
    private readonly authEndpoint = 'https://apigw.iotbing.com',
    private readonly schema = 'homepilotauthorize',
  ) {}

  public async createAuthorization(userCode: string): Promise<TuyaAuthorizationSession> {
    const normalized = userCode.trim();
    if (!this.clientId || !normalized) throw new Error('TUYA_USER_CODE_INVALID');
    const url = `${this.authEndpoint}/v1.0/m/life/home-assistant/qrcode/tokens?clientid=${encodeURIComponent(this.clientId)}&usercode=${encodeURIComponent(normalized)}&schema=${encodeURIComponent(this.schema)}`;
    const payload = await this.json<TuyaApiResponse<{ qrcode: string; expire_time?: number }>>(await fetch(url, { method: 'POST' }));
    if (!payload.success || !payload.result?.qrcode) throw new Error(payload.msg || 'TUYA_QR_UNAVAILABLE');
    return {
      qrToken: payload.result.qrcode,
      qrCode: `tuyaSmart--qrLogin?token=${payload.result.qrcode}`,
      expiresAt: payload.result.expire_time ? Date.now() + payload.result.expire_time * 1000 : null,
    };
  }

  public async completeAuthorization(userCode: string, qrToken: string): Promise<TuyaAuthorization | null> {
    if (!this.clientId) throw new Error('TUYA_CLIENT_NOT_CONFIGURED');
    const url = `${this.authEndpoint}/v1.0/m/life/home-assistant/qrcode/tokens/${encodeURIComponent(qrToken)}?clientid=${encodeURIComponent(this.clientId)}&usercode=${encodeURIComponent(userCode)}`;
    const payload = await this.json<TuyaApiResponse<TuyaLoginResult>>(await fetch(url), false);
    if (!payload.success || !payload.result?.access_token) return null;
    return this.toAuthorization(userCode, payload.result, payload.t);
  }

  public async listDevices(): Promise<TuyaCloudDevice[]> {
    const authorization = await this.activeAuthorization();
    const homes = await this.request<Array<{ id: string }>>(authorization, '/v1.0/m/life/ha/homes');
    const deviceGroups = await Promise.all((homes || []).map((home) => this.request<TuyaCloudDevice[]>(authorization, '/v1.0/m/life/ha/home/devices', { homeId: home.id })));
    return deviceGroups.flat();
  }

  public async sendCommands(deviceId: string, commands: Array<{ code: string; value: unknown }>): Promise<void> {
    const authorization = await this.activeAuthorization();
    await this.request(authorization, `/v1.1/m/thing/${encodeURIComponent(deviceId)}/commands`, undefined, { commands });
  }

  public currentAuthorization(): TuyaAuthorization | null {
    return this.authorization;
  }

  private async activeAuthorization(): Promise<TuyaAuthorization> {
    const authorization = this.requireAuthorization();
    if (authorization.expiresAt > Date.now() + 60_000) return authorization;
    const refreshed = await this.request<TuyaLoginResult>(authorization, `/v1.0/m/token/${encodeURIComponent(authorization.refreshToken)}`);
    this.authorization = this.toAuthorization(authorization.userCode, refreshed);
    return this.authorization;
  }

  private requireAuthorization(): TuyaAuthorization {
    if (!this.authorization) throw new Error('TUYA_NOT_CONFIGURED');
    return this.authorization;
  }

  private async request<T>(authorization: TuyaAuthorization, path: string, params?: Record<string, string>, body?: unknown): Promise<T> {
    const requestId = randomUUID();
    const hashKey = createHash('md5').update(`${requestId}${authorization.refreshToken}`).digest('hex');
    const secret = createHmac('sha256', requestId).update(hashKey).digest('hex').slice(0, 16);
    const query = params ? this.encrypt(JSON.stringify(params), secret) : '';
    const encodedBody = body ? this.encrypt(JSON.stringify(body), secret) : '';
    const headers: Record<string, string> = {
      'X-appKey': this.clientId,
      'X-requestId': requestId,
      'X-sid': '',
      'X-time': Date.now().toString(),
      'X-token': authorization.accessToken,
    };
    const signSource = ['X-appKey', 'X-requestId', 'X-sid', 'X-time', 'X-token']
      .filter((key) => headers[key])
      .map((key) => `${key}=${headers[key]}`)
      .join('||') + query + encodedBody;
    headers['X-sign'] = createHmac('sha256', hashKey).update(signSource).digest('hex');
    const url = new URL(`${authorization.endpoint}${path}`);
    if (query) url.searchParams.set('encdata', query);
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify({ encdata: encodedBody }) } : {}),
    });
    const payload = await this.json<TuyaApiResponse<string>>(response);
    if (!payload.success) throw new Error(payload.msg || `TUYA_API_${payload.code || 'ERROR'}`);
    const decrypted = payload.result ? this.decrypt(payload.result, secret) : '';
    return decrypted ? JSON.parse(decrypted) as T : undefined as T;
  }

  private toAuthorization(userCode: string, result: TuyaLoginResult, serverTime?: number): TuyaAuthorization {
    const endpoint = result.endpoint.startsWith('http') ? result.endpoint : `https://${result.endpoint}`;
    return {
      userCode,
      endpoint: endpoint.replace(/\/$/, ''),
      uid: result.uid,
      terminalId: result.terminal_id,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt: (serverTime || Date.now()) + result.expire_time * 1000,
      updatedAt: new Date().toISOString(),
    };
  }

  private encrypt(value: string, secret: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-128-gcm', Buffer.from(secret, 'utf8'), nonce);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return Buffer.concat([nonce, encrypted]).toString('base64');
  }

  private decrypt(value: string, secret: string): string {
    const raw = Buffer.from(value, 'base64');
    const nonce = raw.subarray(0, 12);
    const payload = raw.subarray(12);
    const tag = payload.subarray(-16);
    const encrypted = payload.subarray(0, -16);
    const decipher = createDecipheriv('aes-128-gcm', Buffer.from(secret, 'utf8'), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private async json<T>(response: Response, fail = true): Promise<T> {
    const payload = await response.json() as T;
    if (fail && !response.ok) throw new Error(`TUYA_HTTP_${response.status}`);
    return payload;
  }
}
