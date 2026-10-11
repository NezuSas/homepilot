import type { NativeCameraStreamingService } from '../../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { CAMERA_PROXY_TOKEN_TTL_MS } from './cameraProxyToken';

export interface CameraHlsProxySession {
  readonly deviceId: string;
  expiresAt: number;
  lastAccessAt: number;
  readonly source: 'home-assistant' | 'native';
  readonly masterPath: string;
  readonly resourcesById: Map<string, string>;
  readonly resourceIdsByPath: Map<string, string>;
  readonly nativeDirectory?: string;
}

const DEFAULT_NATIVE_HLS_IDLE_MS = 90_000;
export const NATIVE_HLS_REAPER_INTERVAL_MS = 15_000;

function nativeHlsIdleMs(): number {
  const configured = Number(process.env.HOMEPILOT_NATIVE_HLS_IDLE_MS);
  return Number.isFinite(configured) && configured >= 15_000 ? configured : DEFAULT_NATIVE_HLS_IDLE_MS;
}

/**
 * Estado en memoria de las sesiones HLS del proxy de cámaras: sesiones por token,
 * arranques nativos en curso y reaping de runtimes nativos inactivos.
 */
export class CameraHlsSessionStore {
  readonly sessions = new Map<string, CameraHlsProxySession>();
  private readonly nativeHlsStarts = new Map<string, number>();
  private readonly nativeHlsDevices = new Set<string>();
  private readonly nativeIdleMs = nativeHlsIdleMs();

  constructor(private readonly nativeCameraStreamingService?: NativeCameraStreamingService) {}

  beginNativeStart(deviceId: string): void {
    this.nativeHlsStarts.set(deviceId, (this.nativeHlsStarts.get(deviceId) ?? 0) + 1);
  }

  endNativeStart(deviceId: string): void {
    const remaining = (this.nativeHlsStarts.get(deviceId) ?? 1) - 1;
    if (remaining > 0) this.nativeHlsStarts.set(deviceId, remaining);
    else this.nativeHlsStarts.delete(deviceId);
  }

  register(
    token: string,
    deviceId: string,
    masterPath: string,
    source: CameraHlsProxySession['source'],
    nativeDirectory?: string,
  ): void {
    this.removeExpired();
    if (source === 'native') this.nativeHlsDevices.add(deviceId);
    this.sessions.set(token, {
      deviceId,
      expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
      lastAccessAt: Date.now(),
      source,
      masterPath,
      resourcesById: new Map<string, string>(),
      resourceIdsByPath: new Map<string, string>(),
      nativeDirectory,
    });
  }

  currentTokenForSession(targetSession: CameraHlsProxySession): string {
    for (const [token, session] of this.sessions) {
      if (session === targetSession) return encodeURIComponent(token);
    }
    return '';
  }

  removeExpired(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token);
    }
  }

  reapInactiveNativeHls(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.source !== 'native') continue;
      if (session.expiresAt > now && now - session.lastAccessAt < this.nativeIdleMs) continue;
      this.sessions.delete(token);
    }
    for (const deviceId of this.nativeHlsDevices) {
      if (this.nativeHlsStarts.has(deviceId)) continue;
      const hasViewer = [...this.sessions.values()].some((session) =>
        session.source === 'native' && session.deviceId === deviceId && session.expiresAt > now && now - session.lastAccessAt < this.nativeIdleMs);
      if (!hasViewer) {
        this.nativeCameraStreamingService?.stopHlsRuntime(deviceId);
        this.nativeHlsDevices.delete(deviceId);
      }
    }
  }
}
