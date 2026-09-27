import type { AndroidDisplayMetadata } from '../domain/AndroidDisplaySource';
import {
  AndroidDisplayBridgeError, AndroidDisplayBridgePort, BridgeAction, BridgeConnectionState,
} from '../application/AndroidDisplayBridgePort';

const ERROR_CODES = new Set([
  'UNAUTHORIZED', 'INVALID_ADB_ENDPOINT', 'ADB_ENDPOINT_NOT_ALLOWED', 'DISPLAY_NOT_CONNECTED',
  'ADB_OFFLINE', 'ADB_TIMEOUT', 'ADB_OPERATION_FAILED', 'ADB_VOLUME_RANGE_UNKNOWN',
  'BRIDGE_BUSY', 'DISPLAY_BUSY', 'BRIDGE_CAPACITY_REACHED', 'ACTION_UNSUPPORTED',
]);

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= 128 && /^[\x20-\x7E]+$/.test(clean) ? clean : null;
}

function safeState(value: unknown): BridgeConnectionState {
  if (value === 'online' || value === 'needs_authorization') return value;
  return 'offline';
}

function safeMetadata(value: unknown): AndroidDisplayMetadata {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const density = safeText(raw.density);
  const screen = raw.screenState;
  return {
    adbSerial: safeText(raw.adbSerial),
    androidId: safeText(raw.androidId),
    manufacturer: safeText(raw.manufacturer),
    model: safeText(raw.model),
    androidVersion: safeText(raw.androidVersion),
    resolution: safeText(raw.resolution),
    densityDpi: density && /^\d{1,4}$/.test(density) ? Number(density) : null,
    screenState: screen === 'awake' || screen === 'asleep' || screen === 'dozing' ? screen : 'unknown',
  };
}

/** Private, typed boundary. The URL and token come only from appliance configuration. */
export class HttpAndroidDisplayBridgeClient implements AndroidDisplayBridgePort {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'homepilot-display-bridge'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new AndroidDisplayBridgeError('BRIDGE_CONFIG_INVALID');
    }
    this.baseUrl = url.origin;
  }

  static fromEnvironment(): HttpAndroidDisplayBridgeClient {
    return new HttpAndroidDisplayBridgeClient(
      process.env.HOMEPILOT_DISPLAY_BRIDGE_URL || 'http://127.0.0.1:5002',
      process.env.HOMEPILOT_DISPLAY_BRIDGE_TOKEN || '',
    );
  }

  private async request(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object): Promise<Record<string, unknown>> {
    if (this.token.length < 32) throw new AndroidDisplayBridgeError('BRIDGE_NOT_CONFIGURED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { 'X-HomePilot-Bridge-Token': this.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AndroidDisplayBridgeError('BRIDGE_INVALID_RESPONSE');
      }
      const payload = data as Record<string, unknown>;
      if (!response.ok) {
        const code = payload.error;
        throw new AndroidDisplayBridgeError(typeof code === 'string' && ERROR_CODES.has(code)
          ? code : 'BRIDGE_UNAVAILABLE');
      }
      return payload;
    } catch (error: unknown) {
      if (error instanceof AndroidDisplayBridgeError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AndroidDisplayBridgeError('BRIDGE_TIMEOUT');
      }
      throw new AndroidDisplayBridgeError('BRIDGE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  async connect(sourceId: string, host: string, port: 5555): Promise<BridgeConnectionState> {
    const result = await this.request('POST', '/internal/v1/displays/connect', { sourceId, host, port });
    return safeState(result.state);
  }

  async state(sourceId: string): Promise<BridgeConnectionState> {
    const result = await this.request('GET', `/internal/v1/displays/${encodeURIComponent(sourceId)}/state`);
    return safeState(result.state);
  }

  async inspect(sourceId: string): Promise<AndroidDisplayMetadata> {
    const result = await this.request('GET', `/internal/v1/displays/${encodeURIComponent(sourceId)}/inspect`);
    return safeMetadata(result.metadata);
  }

  async execute(sourceId: string, action: BridgeAction, params: Record<string, unknown>): Promise<void> {
    const result = await this.request('POST', `/internal/v1/displays/${encodeURIComponent(sourceId)}/actions`,
      { name: action, params });
    if (result.status !== 'executed') throw new AndroidDisplayBridgeError('BRIDGE_INVALID_RESPONSE');
  }

  async disconnect(sourceId: string): Promise<void> {
    await this.request('DELETE', `/internal/v1/displays/${encodeURIComponent(sourceId)}/connection`);
  }
}
