import * as http from 'http';
import * as crypto from 'crypto';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { ApiRoutes } from './ApiRoutes';
import { OnvifDiscovery } from '../OnvifDiscovery';

interface NativeCameraSourceRow {
  device_id: string;
  home_id: string;
  name: string;
  host: string;
  onvif_port: number;
  rtsp_port: number;
  username: string;
  password: string;
  rtsp_path: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface CreateNativeCameraBody {
  homeId: string;
  name: string;
  host: string;
  rtspPort?: number;
  onvifPort?: number;
  username: string;
  password: string;
  rtspPath?: string;
}

interface UpdateNativeCameraBody {
  name?: string;
  host?: string;
  rtspPort?: number;
  onvifPort?: number;
  username?: string;
  password?: string;
  rtspPath?: string;
  enabled?: boolean;
}

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

function toNativeCameraDto(row: NativeCameraSourceRow): Record<string, unknown> {
  return {
    deviceId: row.device_id,
    homeId: row.home_id,
    name: row.name,
    host: row.host,
    onvifPort: row.onvif_port,
    rtspPort: row.rtsp_port,
    // password is intentionally omitted from API responses
    maskedPassword: row.password.length > 0 ? '••••••••' : '',
    rtspPath: row.rtsp_path,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class NativeCameraRoutes extends ApiRoutes {
  constructor(private readonly dbPath: string) {
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

      const db = SqliteDatabaseManager.getInstance(this.dbPath);
      const rows = db
        .prepare('SELECT * FROM native_camera_sources WHERE home_id = ? ORDER BY created_at ASC')
        .all(homeId) as NativeCameraSourceRow[];

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

      const rtspPort = body.rtspPort ?? 554;
      const onvifPort = body.onvifPort ?? 8000;
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
      const rtspPath = (body.rtspPath || '').startsWith('/')
        ? (body.rtspPath || '')
        : `/${body.rtspPath || ''}`;

      const db = SqliteDatabaseManager.getInstance(this.dbPath);

      // Create the device in the devices table
      db.prepare(`
        INSERT INTO devices (id, home_id, external_id, name, type, status, capabilities, state, integration_source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'camera', 'active', '["camera"]', '{}', 'native-camera', ?, ?)
      `).run(deviceId, body.homeId, `native:${deviceId}`, body.name.trim(), now, now);

      // Create the native camera source record
      db.prepare(`
        INSERT INTO native_camera_sources (device_id, home_id, name, host, onvif_port, rtsp_port, username, password, rtsp_path, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(deviceId, body.homeId, body.name.trim(), body.host.trim(), onvifPort, rtspPort, body.username, body.password, rtspPath, now, now);

      const created = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?').get(deviceId) as NativeCameraSourceRow;

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
      const db = SqliteDatabaseManager.getInstance(this.dbPath);
      const existing = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?').get(deviceId) as NativeCameraSourceRow | undefined;
      if (!existing) {
        this.sendError(res, 404, 'CAMERA_NOT_FOUND', 'Native camera not found');
        return;
      }

      const body = await this.parseBody<UpdateNativeCameraBody>(req);
      const now = new Date().toISOString();

      const newName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
      const newHost = typeof body.host === 'string' && body.host.trim() ? body.host.trim() : existing.host;
      const newRtspPort = body.rtspPort !== undefined ? body.rtspPort : existing.rtsp_port;
      const newOnvifPort = body.onvifPort !== undefined ? body.onvifPort : existing.onvif_port;
      const newUsername = typeof body.username === 'string' && body.username ? body.username : existing.username;
      const newPassword = typeof body.password === 'string' && body.password ? body.password : existing.password;
      const newRtspPath = typeof body.rtspPath === 'string'
        ? (body.rtspPath.startsWith('/') ? body.rtspPath : `/${body.rtspPath}`)
        : existing.rtsp_path;
      const newEnabled = typeof body.enabled === 'boolean' ? (body.enabled ? 1 : 0) : existing.enabled;

      if (!isValidPort(newRtspPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'rtspPort must be between 1 and 65535');
        return;
      }
      if (!isValidPort(newOnvifPort)) {
        this.sendError(res, 400, 'VALIDATION_ERROR', 'onvifPort must be between 1 and 65535');
        return;
      }

      db.prepare(`
        UPDATE native_camera_sources
        SET name = ?, host = ?, rtsp_port = ?, onvif_port = ?, username = ?, password = ?, rtsp_path = ?, enabled = ?, updated_at = ?
        WHERE device_id = ?
      `).run(newName, newHost, newRtspPort, newOnvifPort, newUsername, newPassword, newRtspPath, newEnabled, now, deviceId);

      // Sync device name if changed
      if (newName !== existing.name) {
        db.prepare('UPDATE devices SET name = ?, updated_at = ? WHERE id = ?').run(newName, now, deviceId);
      }

      const updated = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?').get(deviceId) as NativeCameraSourceRow;
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
      const db = SqliteDatabaseManager.getInstance(this.dbPath);
      const existing = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?').get(deviceId) as NativeCameraSourceRow | undefined;
      if (!existing) {
        this.sendError(res, 404, 'CAMERA_NOT_FOUND', 'Native camera not found');
        return;
      }

      // Deleting the device cascades to native_camera_sources via FK ON DELETE CASCADE
      db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);

      res.writeHead(204);
      res.end();
    } catch (error: unknown) {
      this.sendError(res, 500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to delete camera');
    }
  }
}
