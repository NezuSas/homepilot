import * as crypto from 'crypto';
import type { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type {
  NativeCameraSource,
  NativeCameraSourceRepository,
  NativeCameraSourceType
} from '../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriverRegistry } from './ports/NativeCameraDriverRegistry';
import type { DiscoveredNativeCamera } from './ports/NativeCameraDriver';

export const NATIVE_CAMERA_SOURCE_TYPES: ReadonlyArray<NativeCameraSourceType> = ['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'];

export function isNativeCameraSourceType(value: unknown): value is NativeCameraSourceType {
  return typeof value === 'string' && NATIVE_CAMERA_SOURCE_TYPES.includes(value as NativeCameraSourceType);
}

export function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

function normalizeRtspPath(value: string | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function sourceTypeRequiresManualRtspPath(sourceType: NativeCameraSourceType): boolean {
  return sourceType !== 'onvif-ptz';
}

export interface CreateNativeCameraInput {
  readonly homeId: string;
  readonly sourceType?: NativeCameraSourceType;
  readonly name: string;
  readonly host: string;
  readonly rtspPort?: number;
  readonly onvifPort?: number;
  readonly username: string;
  readonly password: string;
  readonly rtspPath?: string;
}

export interface UpdateNativeCameraInput {
  readonly sourceType?: NativeCameraSourceType;
  readonly name?: string;
  readonly host?: string;
  readonly rtspPort?: number;
  readonly onvifPort?: number;
  readonly username?: string;
  readonly password?: string;
  readonly rtspPath?: string;
  readonly enabled?: boolean;
}

export type NativeCameraServiceErrorKind =
  | 'VALIDATION_ERROR'
  | 'HOME_NOT_FOUND'
  | 'CAMERA_CONNECTION_FAILED'
  | 'NATIVE_CAMERA_ALREADY_EXISTS'
  | 'CAMERA_NOT_FOUND';

export interface NativeCameraServiceError {
  readonly kind: NativeCameraServiceErrorKind;
  readonly message: string;
}

export type NativeCameraServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: NativeCameraServiceError };

function fail<T>(kind: NativeCameraServiceErrorKind, message: string): NativeCameraServiceResult<T> {
  return { ok: false, error: { kind, message } };
}

function ok<T>(value: T): NativeCameraServiceResult<T> {
  return { ok: true, value };
}

/**
 * Use cases for native camera sources (list/create/update/delete/discover).
 * Extracted from the former `NativeCameraRoutes.ts` (Phase 1 package
 * extraction, no behaviour change) so the HTTP layer stays a thin adapter.
 */
export class NativeCameraService {
  constructor(
    private readonly nativeCameraSourceRepository: NativeCameraSourceRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly homeRepository: HomeRepository,
    private readonly driverRegistry: NativeCameraDriverRegistry
  ) {}

  public async discover(): Promise<ReadonlyArray<DiscoveredNativeCamera>> {
    const results = await Promise.all(
      this.driverRegistry.discoverableDrivers().map((driver) => driver.discover())
    );
    return results.flat();
  }

  public listByHome(homeId: string): ReadonlyArray<NativeCameraSource> {
    return this.nativeCameraSourceRepository.findByHomeId(homeId);
  }

  public async create(input: CreateNativeCameraInput): Promise<NativeCameraServiceResult<NativeCameraSource>> {
    if (!input.homeId || typeof input.homeId !== 'string') {
      return fail('VALIDATION_ERROR', 'homeId is required');
    }
    if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
      return fail('VALIDATION_ERROR', 'name is required');
    }
    if (!input.host || typeof input.host !== 'string' || !input.host.trim()) {
      return fail('VALIDATION_ERROR', 'host is required');
    }
    if (!input.username || typeof input.username !== 'string') {
      return fail('VALIDATION_ERROR', 'username is required');
    }
    if (!input.password || typeof input.password !== 'string') {
      return fail('VALIDATION_ERROR', 'password is required');
    }

    const sourceType = isNativeCameraSourceType(input.sourceType) ? input.sourceType : 'onvif-ptz';
    const rtspPort = input.rtspPort ?? 554;
    const onvifPort = input.onvifPort ?? (sourceType === 'onvif-ptz' ? 8000 : 80);
    if (!isValidPort(rtspPort)) return fail('VALIDATION_ERROR', 'rtspPort must be between 1 and 65535');
    if (!isValidPort(onvifPort)) return fail('VALIDATION_ERROR', 'onvifPort must be between 1 and 65535');

    const home = await this.homeRepository.findHomeById(input.homeId);
    if (!home) return fail('HOME_NOT_FOUND', 'Home not found');

    const host = input.host.trim();
    const rtspPath = normalizeRtspPath(input.rtspPath);
    if (sourceTypeRequiresManualRtspPath(sourceType) && !rtspPath) {
      return fail('VALIDATION_ERROR', 'rtspPath is required for RTSP/DVR and Sonoff cameras');
    }

    const driver = this.driverRegistry.resolve(sourceType);
    const negotiation = await driver.negotiate({ host, onvifPort, rtspPort, username: input.username, password: input.password, rtspPath });
    if (negotiation.outcome === 'unauthorized') {
      return fail('CAMERA_CONNECTION_FAILED', 'Credenciales ONVIF/RTSP incorrectas para la cámara.');
    }
    if (negotiation.outcome === 'unreachable') {
      return fail('CAMERA_CONNECTION_FAILED', negotiation.detail);
    }
    const resolvedRtspPort = negotiation.profile.rtspPort;
    const resolvedRtspPath = negotiation.profile.rtspPath;
    const resolvedProfileToken = negotiation.profile.profileToken;
    const resolvedPtzConfigurationToken = negotiation.profile.ptzConfigurationToken;
    const resolvedPtzSupported = negotiation.profile.ptzSupported;

    const duplicate = this.nativeCameraSourceRepository.findDuplicate(input.homeId, host, resolvedRtspPort, resolvedRtspPath);
    if (duplicate) {
      return fail('NATIVE_CAMERA_ALREADY_EXISTS', `La cámara "${duplicate.name}" ya está integrada en HomePilot.`);
    }

    const now = new Date().toISOString();
    const deviceId = `native-cam-${crypto.randomBytes(8).toString('hex')}`;

    await this.deviceRepository.saveDevice({
      id: deviceId,
      homeId: input.homeId,
      roomId: null,
      externalId: `native:${deviceId}`,
      name: input.name.trim(),
      type: 'camera',
      vendor: sourceType,
      status: 'PENDING',
      integrationSource: 'native-camera',
      invertState: false,
      lastKnownState: { ptz: resolvedPtzSupported },
      entityVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    const created: NativeCameraSource = {
      deviceId,
      homeId: input.homeId,
      sourceType,
      name: input.name.trim(),
      host,
      onvifPort,
      rtspPort: resolvedRtspPort,
      username: input.username,
      password: input.password,
      rtspPath: resolvedRtspPath,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      profileToken: resolvedProfileToken,
      ptzConfigurationToken: resolvedPtzConfigurationToken,
      ptzSupported: resolvedPtzSupported
    };
    this.nativeCameraSourceRepository.save(created);

    return ok(created);
  }

  public async update(deviceId: string, input: UpdateNativeCameraInput): Promise<NativeCameraServiceResult<NativeCameraSource>> {
    const existing = this.nativeCameraSourceRepository.findByDeviceId(deviceId);
    if (!existing) return fail('CAMERA_NOT_FOUND', 'Native camera not found');

    const newName = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : existing.name;
    const newSourceType = isNativeCameraSourceType(input.sourceType) ? input.sourceType : existing.sourceType;
    const newHost = typeof input.host === 'string' && input.host.trim() ? input.host.trim() : existing.host;
    const newRtspPort = input.rtspPort !== undefined ? input.rtspPort : existing.rtspPort;
    const newOnvifPort = input.onvifPort !== undefined ? input.onvifPort : existing.onvifPort;
    const newUsername = typeof input.username === 'string' && input.username ? input.username : existing.username;
    const newPassword = typeof input.password === 'string' && input.password ? input.password : existing.password;
    const newRtspPath = typeof input.rtspPath === 'string' ? normalizeRtspPath(input.rtspPath) : existing.rtspPath;
    const newEnabled = typeof input.enabled === 'boolean' ? input.enabled : existing.enabled;

    if (sourceTypeRequiresManualRtspPath(newSourceType) && !newRtspPath) {
      return fail('VALIDATION_ERROR', 'rtspPath is required for RTSP/DVR and Sonoff cameras');
    }
    if (!isValidPort(newRtspPort)) return fail('VALIDATION_ERROR', 'rtspPort must be between 1 and 65535');
    if (!isValidPort(newOnvifPort)) return fail('VALIDATION_ERROR', 'onvifPort must be between 1 and 65535');

    const driver = this.driverRegistry.resolve(newSourceType);
    const negotiation = await driver.negotiate({ host: newHost, onvifPort: newOnvifPort, rtspPort: newRtspPort, username: newUsername, password: newPassword, rtspPath: newRtspPath });
    if (negotiation.outcome === 'unauthorized') {
      return fail('CAMERA_CONNECTION_FAILED', 'Credenciales ONVIF/RTSP incorrectas para la cámara.');
    }
    if (negotiation.outcome === 'unreachable') {
      return fail('CAMERA_CONNECTION_FAILED', negotiation.detail);
    }
    const resolvedRtspPort = negotiation.profile.rtspPort;
    const resolvedRtspPath = negotiation.profile.rtspPath;
    const resolvedProfileToken = negotiation.profile.profileToken;
    const resolvedPtzConfigurationToken = negotiation.profile.ptzConfigurationToken;
    const resolvedPtzSupported = negotiation.profile.ptzSupported;

    const duplicate = this.nativeCameraSourceRepository.findDuplicate(existing.homeId, newHost, resolvedRtspPort, resolvedRtspPath, deviceId);
    if (duplicate) {
      return fail('NATIVE_CAMERA_ALREADY_EXISTS', `La cámara "${duplicate.name}" ya está integrada en HomePilot.`);
    }

    const now = new Date().toISOString();
    const updated: NativeCameraSource = {
      ...existing,
      sourceType: newSourceType,
      name: newName,
      host: newHost,
      rtspPort: resolvedRtspPort,
      onvifPort: newOnvifPort,
      username: newUsername,
      password: newPassword,
      rtspPath: resolvedRtspPath,
      enabled: newEnabled,
      updatedAt: now,
      profileToken: resolvedProfileToken,
      ptzConfigurationToken: resolvedPtzConfigurationToken,
      ptzSupported: resolvedPtzSupported
    };
    this.nativeCameraSourceRepository.save(updated);

    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (device) {
      const nameChanged = newName !== existing.name;
      const ptzChanged = device.lastKnownState?.ptz !== resolvedPtzSupported;
      if (nameChanged || ptzChanged) {
        await this.deviceRepository.saveDevice({
          ...device,
          name: newName,
          lastKnownState: { ...device.lastKnownState, ptz: resolvedPtzSupported },
          updatedAt: now,
          entityVersion: device.entityVersion
        });
      }
    }

    return ok(updated);
  }

  public async delete(deviceId: string): Promise<NativeCameraServiceResult<void>> {
    const existing = this.nativeCameraSourceRepository.findByDeviceId(deviceId);
    if (!existing) return fail('CAMERA_NOT_FOUND', 'Native camera not found');

    // Deleting the device cascades to native_camera_sources via FK ON DELETE CASCADE
    await this.deviceRepository.deleteDevice(deviceId);
    return ok(undefined);
  }
}
