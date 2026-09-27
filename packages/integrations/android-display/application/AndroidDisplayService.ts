import { randomUUID } from 'crypto';
import { isIP } from 'net';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { Device } from '../../../devices/domain/types';
import type { AndroidDisplayBridgePort } from './AndroidDisplayBridgePort';
import { AndroidDisplayBridgeError } from './AndroidDisplayBridgePort';
import type {
  AndroidDisplaySource, AndroidDisplaySourceRepository, AndroidDisplayMetadata,
} from '../domain/AndroidDisplaySource';

export class AndroidDisplayServiceError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'AndroidDisplayServiceError'; }
}

export interface AndroidDisplayEndpoint { readonly host: string; readonly port?: number; }
export interface AdoptAndroidDisplayInput extends AndroidDisplayEndpoint {
  readonly homeId: string;
  readonly name: string;
}

function validatedEndpoint(input: AndroidDisplayEndpoint): { host: string; port: 5555 } {
  if (typeof input.host !== 'string' || isIP(input.host) !== 4 || input.port !== undefined && input.port !== 5555) {
    throw new AndroidDisplayServiceError('INVALID_ADB_ENDPOINT');
  }
  const parts = input.host.split('.').map(Number);
  const privateAddress = parts[0] === 10
    || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
    || parts[0] === 192 && parts[1] === 168;
  if (!privateAddress) throw new AndroidDisplayServiceError('INVALID_ADB_ENDPOINT');
  return { host: parts.join('.'), port: 5555 };
}

const emptyMetadata: AndroidDisplayMetadata = {
  adbSerial: null, androidId: null, manufacturer: null, model: null,
  androidVersion: null, resolution: null, densityDpi: null, screenState: 'unknown',
};

export class AndroidDisplayService {
  constructor(
    private readonly sources: AndroidDisplaySourceRepository,
    private readonly homes: HomeRepository,
    private readonly bridge: AndroidDisplayBridgePort,
  ) {}

  async test(input: AndroidDisplayEndpoint): Promise<{ connectionState: string; metadata: AndroidDisplayMetadata }> {
    const endpoint = validatedEndpoint(input);
    const temporaryId = randomUUID();
    let connected = false;
    try {
      const state = await this.bridge.connect(temporaryId, endpoint.host, endpoint.port);
      connected = true;
      return { connectionState: state, metadata: state === 'online'
        ? await this.bridge.inspect(temporaryId) : emptyMetadata };
    } finally {
      if (connected) await this.bridge.disconnect(temporaryId);
    }
  }

  async adopt(input: AdoptAndroidDisplayInput): Promise<AndroidDisplaySource> {
    const endpoint = validatedEndpoint(input);
    if (typeof input.homeId !== 'string' || !input.homeId || typeof input.name !== 'string'
      || !input.name.trim() || input.name.trim().length > 100) {
      throw new AndroidDisplayServiceError('VALIDATION_ERROR');
    }
    if (!await this.homes.findHomeById(input.homeId)) throw new AndroidDisplayServiceError('HOME_NOT_FOUND');
    if (this.sources.findByEndpoint(endpoint.host, endpoint.port)) {
      throw new AndroidDisplayServiceError('DISPLAY_ALREADY_EXISTS');
    }

    const deviceId = randomUUID();
    let connected = false;
    let saved = false;
    try {
      const state = await this.bridge.connect(deviceId, endpoint.host, endpoint.port);
      connected = true;
      if (state !== 'online') throw new AndroidDisplayServiceError(
        state === 'needs_authorization' ? 'DISPLAY_NEEDS_AUTHORIZATION' : 'DISPLAY_OFFLINE');
      const metadata = await this.bridge.inspect(deviceId);
      if (metadata.androidId && this.sources.findByAndroidId(metadata.androidId)) {
        throw new AndroidDisplayServiceError('DISPLAY_ALREADY_EXISTS');
      }
      const now = new Date().toISOString();
      const device: Device = {
        id: deviceId, homeId: input.homeId, roomId: null,
        externalId: `android-display:${deviceId}`, name: input.name.trim(),
        type: 'smart_display', semanticType: 'smart_display',
        vendor: metadata.manufacturer ?? 'android-display', status: 'PENDING',
        integrationSource: 'android-display', invertState: false,
        lastKnownState: { connectionState: 'online', screenState: metadata.screenState },
        entityVersion: 1, createdAt: now, updatedAt: now,
      };
      const source: AndroidDisplaySource = {
        deviceId, homeId: input.homeId, adbHost: endpoint.host, adbPort: endpoint.port,
        enabled: true, createdAt: now, updatedAt: now,
        connectionState: 'online', lastSeenAt: now, metadata,
      };
      try {
        this.sources.createWithDevice(device, source);
      } catch (error: unknown) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
          throw new AndroidDisplayServiceError('DISPLAY_ALREADY_EXISTS');
        }
        throw error;
      }
      saved = true;
      return source;
    } finally {
      if (connected && !saved) await this.bridge.disconnect(deviceId).catch(() => undefined);
    }
  }

  list(homeId: string): ReadonlyArray<AndroidDisplaySource> { return this.sources.listByHomeId(homeId); }
  get(deviceId: string): AndroidDisplaySource | null { return this.sources.findByDeviceId(deviceId); }

  async refresh(deviceId: string): Promise<AndroidDisplaySource> {
    const source = this.sources.findByDeviceId(deviceId);
    if (!source) throw new AndroidDisplayServiceError('DISPLAY_NOT_FOUND');
    if (!source.enabled) throw new AndroidDisplayServiceError('DISPLAY_DISABLED');
    const now = new Date().toISOString();
    let state: 'online' | 'offline' | 'needs_authorization';
    try {
      state = await this.bridge.connect(deviceId, source.adbHost, source.adbPort);
    } catch (error: unknown) {
      if (!(error instanceof AndroidDisplayBridgeError)) throw error;
      const offline: AndroidDisplaySource = {
        ...source, connectionState: source.connectionState === 'identity_mismatch' ? 'identity_mismatch' : 'offline', updatedAt: now,
        metadata: { ...source.metadata, screenState: 'unknown' },
      };
      this.sources.updateObservation(offline);
      throw error;
    }
    if (state !== 'online') {
      const updated = { ...source,
        connectionState: source.connectionState === 'identity_mismatch' ? 'identity_mismatch' as const : state,
        metadata: { ...source.metadata, screenState: 'unknown' as const }, updatedAt: now };
      this.sources.updateObservation(updated);
      return updated;
    }
    let metadata: AndroidDisplayMetadata;
    try {
      metadata = await this.bridge.inspect(deviceId);
    } catch (error: unknown) {
      const offline: AndroidDisplaySource = {
        ...source, connectionState: source.connectionState === 'identity_mismatch' ? 'identity_mismatch' : 'offline', updatedAt: now,
        metadata: { ...source.metadata, screenState: 'unknown' },
      };
      this.sources.updateObservation(offline);
      throw error;
    }
    const identityMismatch = source.metadata.androidId &&
      (!metadata.androidId || source.metadata.androidId !== metadata.androidId);
    const updated: AndroidDisplaySource = {
      ...source, updatedAt: now, lastSeenAt: now,
      connectionState: identityMismatch || source.connectionState === 'identity_mismatch'
        ? 'identity_mismatch' : 'online',
      metadata: identityMismatch || source.connectionState === 'identity_mismatch'
        ? { ...source.metadata, screenState: 'unknown' } : metadata,
    };
    this.sources.updateObservation(updated);
    return updated;
  }
}
