import * as http from 'http';
import * as crypto from 'crypto';
import * as net from 'net';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { NativeCameraSource, NativeCameraSourceRepository, NativeCameraSourceType } from '../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import { ApiRoutes } from './ApiRoutes';
import { OnvifDiscovery } from '../OnvifDiscovery';


interface CreateNativeCameraBody {
  homeId: string;
  sourceType?: NativeCameraSourceType;
  name: string;
  host: string;
  rtspPort?: number;
  onvifPort?: number;
  username: string;
  password: string;
  rtspPath?: string;
}

interface UpdateNativeCameraBody {
  sourceType?: NativeCameraSourceType;
  name?: string;
  host?: string;
  rtspPort?: number;
  onvifPort?: number;
  username?: string;
  password?: string;
  rtspPath?: string;
  enabled?: boolean;
}

const NATIVE_CAMERA_SOURCE_TYPES: NativeCameraSourceType[] = ['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'];

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

function isNativeCameraSourceType(value: unknown): value is NativeCameraSourceType {
  return typeof value === 'string' && NATIVE_CAMERA_SOURCE_TYPES.includes(value as NativeCameraSourceType);
}

function normalizeRtspPath(value: string | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function sourceTypeRequiresManualRtspPath(sourceType: NativeCameraSourceType): boolean {
  return sourceType !== 'onvif-ptz';
}

function toNativeCameraDto(source: NativeCameraSource): Record<string, unknown> {
  return {
    deviceId: source.deviceId,
    homeId: source.homeId,
    sourceType: source.sourceType,
    name: source.name,
    host: source.host,
    onvifPort: source.onvifPort,
    rtspPort: source.rtspPort,
    // password is intentionally omitted from API responses
    maskedPassword: source.password.length > 0 ? '••••••••' : '',
    rtspPath: source.rtspPath,
    enabled: source.enabled,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export class NativeCameraRoutes extends ApiRoutes {
  constructor(private readonly nativeCameraSourceRepository: NativeCameraSourceRepository) {
    super();
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    // GET /api/v1/native-cameras/discover
    if (method === 'GET' && pathname === '/api/v1/native-cameras/discover') {
      await this.discoverCameras(req, res, container);
      return true;
    }

    // GET /api/v1/native-cameras?homeId=<id>
    if (method === 'GET' && pathname === '/api/v1/native-cameras') {
      await this.listNativeCameras(req, res, container);
      return true;
    }

    // POST /api/v1/native-cameras
    if (method === 'POST' && pathname === '/api/v1/native-cameras') {
      await this.createNativeCamera(req, res, container);
      return true;
    }

    // PUT /api/v1/native-cameras/:deviceId
    const putMatch = method === 'PUT'
      ? pathname.match(/^\/api\/v1\/native-cameras\/([^/]+)$/)
      : null;
    if (putMatch) {
      await this.updateNativeCamera(req, res, container, decodeURIComponent(putMatch[1]));
      return true;
    }

    // DELETE /api/v1/native-cameras/:deviceId
    const deleteMatch = method === 'DELETE'
      ? pathname.match(/^\/api\/v1\/native-cameras\/([^/]+)$/)
      : null;
    if (deleteMatch) {
      await this.deleteNativeCamera(req, res, container, decodeURIComponent(deleteMatch[1]));
      return true;
    }

    return false;
  }

  private async discoverCameras(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const devices = await OnvifDiscovery.discover();
      this.sendJson(res, { devices });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to discover cameras');
    }
  }

  private async listNativeCameras(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const url = new URL(req.url || '/api/v1/native-cameras', 'http://localhost');
      const homeId = url.searchParams.get('homeId');
      if (!homeId) {
        this.sendError(res, 400, 'MISSING_HOME_ID', 'homeId query parameter is required');
        return;
      }
      const rows = this.nativeCameraSourceRepository.findByHomeId(homeId);

      this.sendJson(res, { cameras: rows.map(toNativeCameraDto) });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to list cameras');
    }
  }

  private async createNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const body = await this.parseBody<CreateNativeCameraBody>(req);

      // Validation
      if (!body.homeId || typeof body.homeId !== 'string') {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'homeId is required');
        return;
      }
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'name is required');
        return;
      }
      if (!body.host || typeof body.host !== 'string' || !body.host.trim()) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'host is required');
        return;
      }
      if (!body.username || typeof body.username !== 'string') {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'username is required');
        return;
      }
      if (!body.password || typeof body.password !== 'string') {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'password is required');
        return;
      }

      const sourceType = isNativeCameraSourceType(body.sourceType) ? body.sourceType : 'onvif-ptz';
      const rtspPort = body.rtspPort ?? 554;
      const onvifPort = body.onvifPort ?? (sourceType === 'onvif-ptz' ? 8000 : 80);
      if (!isValidPort(rtspPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'rtspPort must be between 1 and 65535');
        return;
      }
      if (!isValidPort(onvifPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'onvifPort must be between 1 and 65535');
        return;
      }

      // Verify home exists
      const home = await container.repositories.homeRepository.findHomeById(body.homeId);
      if (!home) {
        this.sendError(res, 404, 'HOME_NOT_FOUND', 'Home not found');
        return;
      }

      const now = new Date().toISOString();
      const deviceId = `native-cam-${crypto.randomBytes(8).toString('hex')}`;
      const rtspPath = normalizeRtspPath(body.rtspPath);
      if (sourceTypeRequiresManualRtspPath(sourceType) && !rtspPath) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'rtspPath is required for RTSP/DVR and Sonoff cameras');
        return;
      }

      let resolvedRtspPort = rtspPort;
      let resolvedRtspPath = rtspPath;
      let onvifSuccess = false;

      if (sourceType === 'onvif-ptz') {
        try {
          const onvif = require('node-onvif');
          const onvifDevice = new onvif.OnvifDevice({
            xaddr: `http://${body.host.trim()}:${onvifPort}/onvif/device_service`,
            user: body.username,
            pass: body.password
          });
          await onvifDevice.init();
          const streamUrl = onvifDevice.getUdpStreamUrl();
          if (streamUrl) {
            const match = streamUrl.match(/rtsp:\/\/[^/]+(?::(\d+))?(\/.*)/i);
            if (match) {
              resolvedRtspPort = match[1] ? parseInt(match[1], 10) : 554;
              resolvedRtspPath = match[2];
              onvifSuccess = true;
            }
          }
        } catch (onvifErr: unknown) {
          const errMsg = String(onvifErr instanceof Error ? onvifErr.message : onvifErr).toLowerCase();
          if (errMsg.includes('auth') || errMsg.includes('unauthorized') || errMsg.includes('401')) {
            this.sendError(res, 400, 'CAMERA_CONNECTION_FAILED', 'Credenciales ONVIF/RTSP incorrectas para la cámara.');
            return;
          }
          console.warn('[ONVIF] Negotiation failed, falling back to manual TCP check:', onvifErr);
        }
      }

      if (!onvifSuccess) {
        const reachable = await this.checkTcpReachable(body.host.trim(), rtspPort, 5000);
        if (!reachable) {
          this.sendError(res, 400, 'CAMERA_CONNECTION_FAILED', `No se pudo alcanzar la cámara en ${body.host.trim()}:${rtspPort}. Verifique la IP, el puerto RTSP y que la cámara esté encendida.`);
          return;
        }
      }

      const duplicate = this.nativeCameraSourceRepository.findDuplicate(body.homeId, body.host.trim(), resolvedRtspPort, resolvedRtspPath);
      if (duplicate) {
        this.sendError(res, 409, 'NATIVE_CAMERA_ALREADY_EXISTS', `La cámara "${duplicate.name}" ya está integrada en HomePilot.`);
        return;
      }

      // Create the device using the repository to ensure schema constraints are respected
      await container.repositories.deviceRepository.saveDevice({
        id: deviceId,
        homeId: body.homeId,
        roomId: null,
        externalId: `native:${deviceId}`,
        name: body.name.trim(),
        type: 'camera',
        vendor: sourceType,
        status: 'PENDING',
        integrationSource: 'native-camera',
        invertState: false,
        lastKnownState: {},
        entityVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      const created: NativeCameraSource = { deviceId, homeId: body.homeId, sourceType, name: body.name.trim(), host: body.host.trim(), onvifPort, rtspPort: resolvedRtspPort, username: body.username, password: body.password, rtspPath: resolvedRtspPath, enabled: true, createdAt: now, updatedAt: now };
      this.nativeCameraSourceRepository.save(created);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ camera: toNativeCameraDto(created) }));
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to create camera');
    }
  }

  private async updateNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const existing = this.nativeCameraSourceRepository.findByDeviceId(deviceId);
      if (!existing) {
        this.sendError(res, 404, 'CAMERA_NOT_FOUND', 'Native camera not found');
        return;
      }

      const body = await this.parseBody<UpdateNativeCameraBody>(req);
      const now = new Date().toISOString();

      const newName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
      const newSourceType = isNativeCameraSourceType(body.sourceType) ? body.sourceType : (existing.sourceType);
      const newHost = typeof body.host === 'string' && body.host.trim() ? body.host.trim() : existing.host;
      const newRtspPort = body.rtspPort !== undefined ? body.rtspPort : existing.rtspPort;
      const newOnvifPort = body.onvifPort !== undefined ? body.onvifPort : existing.onvifPort;
      const newUsername = typeof body.username === 'string' && body.username ? body.username : existing.username;
      const newPassword = typeof body.password === 'string' && body.password ? body.password : existing.password;
      const newRtspPath = typeof body.rtspPath === 'string'
        ? normalizeRtspPath(body.rtspPath)
        : existing.rtspPath;
      const newEnabled = typeof body.enabled === 'boolean' ? body.enabled : existing.enabled;
      if (sourceTypeRequiresManualRtspPath(newSourceType) && !newRtspPath) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'rtspPath is required for RTSP/DVR and Sonoff cameras');
        return;
      }

      if (!isValidPort(newRtspPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'rtspPort must be between 1 and 65535');
        return;
      }
      if (!isValidPort(newOnvifPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'onvifPort must be between 1 and 65535');
        return;
      }

      let resolvedRtspPort = newRtspPort;
      let resolvedRtspPath = newRtspPath;
      let onvifSuccess = false;

      if (newSourceType === 'onvif-ptz') {
        try {
          const onvif = require('node-onvif');
          const onvifDevice = new onvif.OnvifDevice({
            xaddr: `http://${newHost}:${newOnvifPort}/onvif/device_service`,
            user: newUsername,
            pass: newPassword
          });
          await onvifDevice.init();
          const streamUrl = onvifDevice.getUdpStreamUrl();
          if (streamUrl) {
            const match = streamUrl.match(/rtsp:\/\/[^/]+(?::(\d+))?(\/.*)/i);
            if (match) {
              resolvedRtspPort = match[1] ? parseInt(match[1], 10) : 554;
              resolvedRtspPath = match[2];
              onvifSuccess = true;
            }
          }
        } catch (onvifErr: unknown) {
          const errMsg = String(onvifErr instanceof Error ? onvifErr.message : onvifErr).toLowerCase();
          if (errMsg.includes('auth') || errMsg.includes('unauthorized') || errMsg.includes('401')) {
            this.sendError(res, 400, 'CAMERA_CONNECTION_FAILED', 'Credenciales ONVIF/RTSP incorrectas para la cámara.');
            return;
          }
          console.warn('[ONVIF] Negotiation failed, falling back to manual TCP check:', onvifErr);
        }
      }

      if (!onvifSuccess) {
        const reachable = await this.checkTcpReachable(newHost, newRtspPort, 5000);
        if (!reachable) {
          this.sendError(res, 400, 'CAMERA_CONNECTION_FAILED', `No se pudo alcanzar la cámara en ${newHost}:${newRtspPort}. Verifique la IP, el puerto RTSP y que la cámara esté encendida.`);
          return;
        }
      }

      const duplicate = this.nativeCameraSourceRepository.findDuplicate(existing.homeId, newHost, resolvedRtspPort, resolvedRtspPath, deviceId);
      if (duplicate) {
        this.sendError(res, 409, 'NATIVE_CAMERA_ALREADY_EXISTS', `La cámara "${duplicate.name}" ya está integrada en HomePilot.`);
        return;
      }

      const updated: NativeCameraSource = { ...existing, sourceType: newSourceType, name: newName, host: newHost, rtspPort: resolvedRtspPort, onvifPort: newOnvifPort, username: newUsername, password: newPassword, rtspPath: resolvedRtspPath, enabled: newEnabled, updatedAt: now };
      this.nativeCameraSourceRepository.save(updated);

      if (newName !== existing.name) {
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (device) await container.repositories.deviceRepository.saveDevice({ ...device, name: newName, updatedAt: now, entityVersion: device.entityVersion });
      }
      this.sendJson(res, { camera: toNativeCameraDto(updated) });
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to update camera');
    }
  }

  private async deleteNativeCamera(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return;

    try {
      const existing = this.nativeCameraSourceRepository.findByDeviceId(deviceId);
      if (!existing) {
        this.sendError(res, 404, 'CAMERA_NOT_FOUND', 'Native camera not found');
        return;
      }

      // Deleting the device cascades to native_camera_sources via FK ON DELETE CASCADE
      await container.repositories.deviceRepository.deleteDevice(deviceId);

      res.writeHead(204);
      res.end();
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to delete camera');
    }
  }

  private checkTcpReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const done = (result: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
      socket.connect(port, host);
    });
  }
}
