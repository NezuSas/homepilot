import { API_BASE_URL } from '../config';
import { apiFetch } from './apiClient';

const base = `${API_BASE_URL}/api/v1`;

export interface AndroidDisplayMetadata {
  adbSerial: string | null;
  androidId: string | null;
  manufacturer: string | null;
  model: string | null;
  androidVersion: string | null;
  resolution: string | null;
  densityDpi: number | null;
  screenState: 'awake' | 'asleep' | 'dozing' | 'unknown';
}

export interface AndroidDisplaySource {
  deviceId: string;
  homeId: string;
  adbHost: string;
  adbPort: number;
  connectionState: 'online' | 'offline' | 'needs_authorization' | 'identity_mismatch';
  lastSeenAt: string | null;
  metadata: AndroidDisplayMetadata;
}

export interface AndroidDisplayTestResult {
  connectionState: AndroidDisplaySource['connectionState'];
  metadata: AndroidDisplayMetadata;
}

export class AndroidDisplayApiError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    let code = 'UNKNOWN';
    try {
      const payload = await response.json() as { error?: { code?: string } };
      if (typeof payload.error?.code === 'string') code = payload.error.code;
    } catch { /* Only a trusted code, never raw server text, reaches the UI. */ }
    throw new AndroidDisplayApiError(code);
  }
  return await response.json() as T;
}

function post(body: object): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const androidDisplayApi = {
  list: (homeId: string, signal?: AbortSignal) => json<{ displays: AndroidDisplaySource[] }>(
    `${base}/android-displays?homeId=${encodeURIComponent(homeId)}`, { signal }),
  get: (deviceId: string, signal?: AbortSignal) => json<{ display: AndroidDisplaySource }>(
    `${base}/android-displays/${encodeURIComponent(deviceId)}`, { signal }),
  test: (homeId: string, host: string, port: number) => json<AndroidDisplayTestResult>(
    `${base}/android-displays/test`, post({ homeId, host, port })),
  adopt: (homeId: string, name: string, host: string, port: number) => json<{ display: AndroidDisplaySource }>(
    `${base}/android-displays`, post({ homeId, name, host, port })),
  refresh: (deviceId: string) => json<{ display: AndroidDisplaySource }>(
    `${base}/android-displays/${encodeURIComponent(deviceId)}/refresh`, { method: 'POST' }),
  command: (deviceId: string, name: 'navigate_home' | 'navigate_back' | 'volume_set', volume?: number) =>
    json<unknown>(`${base}/devices/${encodeURIComponent(deviceId)}/command`, post({
      command: name === 'volume_set' ? { name, params: { volume } } : name,
    })),
};
