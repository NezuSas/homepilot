import * as http from 'http';
import * as crypto from 'crypto';
import { BootstrapContainer } from '../../bootstrap';
import { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { assignDeviceUseCase } from '../../packages/devices/application/assignDeviceUseCase';
import { executeDeviceCommandUseCase } from '../../packages/devices/application/executeDeviceCommandUseCase';
import { enableAutomationRuleUseCase } from '../../packages/devices/application/usecases/automation/EnableAutomationRuleUseCase';
import { disableAutomationRuleUseCase } from '../../packages/devices/application/usecases/automation/DisableAutomationRuleUseCase';
import { createAutomationRuleUseCase } from '../../packages/devices/application/usecases/automation/CreateAutomationRuleUseCase';
import { deleteAutomationRuleUseCase } from '../../packages/devices/application/usecases/automation/DeleteAutomationRuleUseCase';
import { updateAutomationRuleUseCase } from '../../packages/devices/application/usecases/automation/UpdateAutomationRuleUseCase';
import { LocalConsoleCommandDispatcher } from './LocalConsoleCommandDispatcher';
import { HomeAssistantCommandDispatcher } from './HomeAssistantCommandDispatcher';
import { CompositeCommandDispatcher } from './CompositeCommandDispatcher';
import { syncDeviceStateUseCase } from '../../packages/devices/application/syncDeviceStateUseCase';
import { AutomationRule, AutomationTrigger, AutomationAction } from '../../packages/devices/domain/automation/types';
import { DeviceCommandV1, isValidCommand } from '../../packages/devices/domain/commands';

interface LocalHomeRow {
  id: string;
  owner_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

interface LocalDeviceRow {
  id: string;
  home_id: string;
  room_id: string | null;
  external_id: string;
  name: string;
  type: string;
  vendor: string;
  status: string;
  last_known_state: string | null;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

interface LocalRoomRow {
  id: string;
  home_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

interface CreateAutomationPayload {
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

interface UpdateAutomationPayload {
  name?: string;
  trigger?: AutomationTrigger;
  action?: AutomationAction;
}

/**
 * Servidor de API local para la Operator Console V1.
 */
export class OperatorConsoleServer {
  private server: http.Server;

  constructor(
    private readonly container: BootstrapContainer,
    private readonly dbPath: string,
    private readonly port: number = 3000
  ) {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  public start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[OperatorConsoleServer] API local en http://localhost:${this.port}`);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const { url = '', method = 'GET' } = req;
    const pathname = new URL(url, `http://${req.headers.host || 'localhost'}`).pathname;
    const db = SqliteDatabaseManager.getInstance(this.dbPath);

    // ---------------------------------------------------------
    // SETUP STATUS PUBLIC / OPERATOR ENDPOINT
    // ---------------------------------------------------------
    if (method === 'GET' && pathname === '/api/v1/system/setup-status') {
      const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return;
      const authReq = req as any;
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'operator')) return;

      try {
        const status = await this.container.services.systemSetupService.getSetupStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } catch (e: any) {
        this.sendError(res, 500, e.message);
      }
      return;
    }

    // ---------------------------------------------------------
    // SYSTEM SETUP COMPLETE (ADMIN ONLY)
    // ---------------------------------------------------------
    if (method === 'POST' && pathname === '/api/v1/system/setup-status/complete') {
      const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return;
      
      const authReq = req as any;
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;

      try {
        await this.container.services.systemSetupService.completeOnboarding(authReq.user!.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e: any) {
        const msg = e.message;
        if (msg === 'NO_CONFIG') {
          this.sendError(res, 400, 'Home Assistant Configuration is missing (NO_CONFIG)');
        } else if (msg === 'AUTH_ERROR') {
          this.sendError(res, 400, 'Home Assistant Access Token is invalid (HA_AUTH_ERROR)');
        } else if (msg === 'UNREACHABLE') {
          this.sendError(res, 400, 'Home Assistant Server is unreachable (HA_UNREACHABLE)');
        } else {
          this.sendError(res, 500, e.message);
        }
      }
      return;
    }

    // -- AUTH V1 ENDPOINTS --
    if (pathname.startsWith('/api/v1/auth/')) {
      if (method === 'POST' && pathname === '/api/v1/auth/login') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            if (!payload.username || !payload.password) return this.sendError(res, 400, 'Missing credentials');
            const result = await this.container.services.authService.login(payload.username, payload.password);
            
            if (!result) {
              await this.container.repositories.activityLogRepository.saveActivity({
                deviceId: 'system-auth', type: 'AUTH_FAILED' as any, timestamp: new Date().toISOString(), description: `Failed login attempt for user ${payload.username}`, data: {}
              });
              return this.sendError(res, 401, 'Invalid credentials');
            }

            await this.container.repositories.activityLogRepository.saveActivity({
              deviceId: 'system-auth', type: 'AUTH_SUCCESS' as any, timestamp: new Date().toISOString(), description: `User ${result.user.username} logged in`, data: { username: result.user.username }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
          } catch (e) {
            this.sendError(res, 500, 'Internal Error');
          }
        });
        return;
      }

      // Rest of Auth Endpoints require token to be decoded, but logout won't crash if bad
      const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return; // Response is handled by the guard

      const authReq = req as any;

      if (method === 'POST' && pathname === '/api/v1/auth/logout') {
        const token = req.headers['authorization']?.replace('Bearer ', '').trim();
        if (token) {
          await this.container.services.authService.logout(token);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
        return;
      }

      if (method === 'GET' && pathname === '/api/v1/auth/me') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(authReq.user));
        return;
      }

      if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            if (!payload.currentPassword || !payload.newPassword) return this.sendError(res, 400, 'Missing fields');
            
            const result = await this.container.services.authService.changePassword(authReq.user.id, payload.currentPassword, payload.newPassword);
            if (!result.success) return this.sendError(res, 400, 'Failed to change password');
            
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
          } catch (e) {
            this.sendError(res, 500, 'Internal Error');
          }
        });
        return;
      }

      // 404 for unknown auth routes
      this.sendError(res, 404, 'Auth route not found');
      return;
    }

    // -- PROTECTED SYSTEM ROUTES --
    const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return;

    // From here, req.user is guaranteed populated
    const authReq = req as any;

    // GET /api/v1/system/diagnostics
    if (method === 'GET' && pathname === '/api/v1/system/diagnostics') {
      try {
        const snapshot = await this.container.services.diagnosticsService.getSnapshot();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(snapshot));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/system/diagnostics/events
    if (method === 'GET' && pathname === '/api/v1/system/diagnostics/events') {
      try {
        const events = await this.container.services.diagnosticsService.getRecentEvents(50);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(events));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/homes
    if (method === 'GET' && pathname === '/api/v1/homes') {
      try {
        const rows = db.prepare('SELECT * FROM homes').all() as LocalHomeRow[];
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows.map(r => ({
          id: r.id, ownerId: r.owner_id, name: r.name, entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        }))));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/homes/:id/rooms
    const roomsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (roomsMatch) {
      try {
        const homeId = roomsMatch[1];
        const rows = db.prepare('SELECT * FROM rooms WHERE home_id = ?').all(homeId) as LocalRoomRow[];
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows.map(r => ({
          id: r.id, homeId: r.home_id, name: r.name, entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        }))));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/devices/:id/activity-logs
    const deviceLogsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/activity-logs$/);
    if (deviceLogsMatch) {
      try {
        const deviceId = deviceLogsMatch[1];
        const logs = await this.container.repositories.activityLogRepository.findRecentByDeviceId(deviceId, 20);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(logs));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/devices/:id
    const deviceDetailMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (deviceDetailMatch) {
      try {
        const deviceId = deviceDetailMatch[1];
        const device = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'Device not found');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(device));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/devices
    if (method === 'GET' && pathname === '/api/v1/devices') {
      try {
        const rows = db.prepare('SELECT * FROM devices ORDER BY status DESC, created_at DESC').all() as LocalDeviceRow[];
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows.map(r => ({
          id: r.id, homeId: r.home_id, roomId: r.room_id, externalId: r.external_id, name: r.name, type: r.type, vendor: r.vendor,
          status: r.status, lastKnownState: r.last_known_state ? JSON.parse(r.last_known_state) : null,
          entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        }))));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/activity-logs
    if (method === 'GET' && pathname === '/api/v1/activity-logs') {
      try {
        const logs = await this.container.repositories.activityLogRepository.findAllRecent(50);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(logs));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/automations
    if (method === 'GET' && pathname === '/api/v1/automations') {
      try {
        const rules = await this.container.repositories.automationRuleRepository.findAll();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rules));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // POST /api/v1/automations
    if (method === 'POST' && pathname === '/api/v1/automations') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as CreateAutomationPayload;
          const home = db.prepare('SELECT id FROM homes LIMIT 1').get() as { id: string } | undefined;
          if (!home) return this.sendError(res, 500, 'No local home found');

          const result = await createAutomationRuleUseCase({
            homeId: home.id, userId: 'local-op', name: payload.name, trigger: payload.trigger, action: payload.action
          }, {
            automationRuleRepository: this.container.repositories.automationRuleRepository,
            deviceRepository: this.container.repositories.deviceRepository,
            topologyReferencePort: { 
              validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, 
              validateRoomBelongsToHome: async () => {} 
            },
            idGenerator: { generate: () => crypto.randomUUID() }
          });
          res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
        } catch (error: unknown) {
          const name = error instanceof Error ? error.constructor.name : '';
          let code = 500;
          if (name === 'DeviceNotFoundError') code = 404;
          else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') code = 400;
          this.sendError(res, code, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }

    // PATCH /api/v1/automations/:id
    const patchAutoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (patchAutoMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      const ruleId = patchAutoMatch[1];
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as UpdateAutomationPayload;
          const ports = { validateHomeOwnership: async () => {}, validateHomeExists: async () => {}, validateRoomBelongsToHome: async () => {} };
          const result = await updateAutomationRuleUseCase(ruleId, 'local-op', payload, {
            automationRuleRepository: this.container.repositories.automationRuleRepository,
            deviceRepository: this.container.repositories.deviceRepository,
            topologyReferencePort: ports
          });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
        } catch (error: unknown) {
          const name = error instanceof Error ? error.constructor.name : '';
          let code = 500;
          if (name === 'AutomationRuleNotFoundError') code = 404;
          else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') code = 400;
          this.sendError(res, code, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }

    // PATCH /api/v1/automations/:id/(enable|disable)
    const autoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)\/(enable|disable)$/);
    if (autoMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      const ruleId = autoMatch[1];
      const act = autoMatch[2];
      try {
        const ports = { validateHomeOwnership: async () => {}, validateHomeExists: async () => {}, validateRoomBelongsToHome: async () => {} };
        const result = act === 'enable' 
          ? await enableAutomationRuleUseCase(ruleId, 'local-op', { automationRuleRepository: this.container.repositories.automationRuleRepository, topologyReferencePort: ports })
          : await disableAutomationRuleUseCase(ruleId, 'local-op', { automationRuleRepository: this.container.repositories.automationRuleRepository, topologyReferencePort: ports });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : '';
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // DELETE /api/v1/automations/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (deleteMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      const ruleId = deleteMatch[1];
      try {
        const ports = { validateHomeOwnership: async () => {}, validateHomeExists: async () => {}, validateRoomBelongsToHome: async () => {} };
        await deleteAutomationRuleUseCase(ruleId, 'local-op', { 
          automationRuleRepository: this.container.repositories.automationRuleRepository, 
          topologyReferencePort: ports 
        });
        res.writeHead(204).end();
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : '';
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/settings/home-assistant
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant') {
      try {
        const result = await this.container.services.homeAssistantSettingsService.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // POST /api/v1/settings/home-assistant
    if (method === 'POST' && pathname === '/api/v1/settings/home-assistant') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as { baseUrl: string; accessToken?: string };
          if (!payload.baseUrl) return this.sendError(res, 400, 'Missing baseUrl');
          await this.container.services.homeAssistantSettingsService.saveSettings(payload.baseUrl, payload.accessToken);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
        } catch (error: unknown) {
          this.sendError(res, 400, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }

    // POST /api/v1/settings/home-assistant/test
    if (method === 'POST' && pathname === '/api/v1/settings/home-assistant/test') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as { baseUrl: string; accessToken: string };
          if (!payload.baseUrl || !payload.accessToken) return this.sendError(res, 400, 'Missing parameters');
          const result = await this.container.services.homeAssistantSettingsService.testConnection(payload.baseUrl, payload.accessToken);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
        } catch (error: unknown) {
          this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }

    // GET /api/v1/settings/home-assistant/status
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant/status') {
      try {
        const result = await this.container.services.homeAssistantSettingsService.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          connectivityStatus: result.connectivityStatus,
          lastCheckedAt: result.lastCheckedAt
        }));
      } catch (error: unknown) {
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // GET /api/v1/ha/entities
    if (method === 'GET' && pathname === '/api/v1/ha/entities') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      return this.handleHaDiscovery(req, res);
    }

    // POST /api/v1/ha/import
    if (method === 'POST' && pathname === '/api/v1/ha/import') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      return this.handleHaImport(req, res);
    }

    // POST /api/v1/devices/:id/refresh
    const refreshMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/refresh$/);
    if (refreshMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const deviceId = refreshMatch[1];
        let device = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'Device not found');
        if (!device.externalId.startsWith('ha:')) {
          return this.sendError(res, 400, 'Only Home Assistant devices can be refreshed via this endpoint');
        }
        const entityId = device.externalId.split(':')[1];
        const haState = await this.container.adapters.homeAssistantConnectionProvider.getClient().getEntityState(entityId);
        
        if (!haState) {
          this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
          return this.sendError(res, 502, 'Could not retrieve state from Home Assistant');
        }
        
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const newState: Record<string, unknown> = { ...device.lastKnownState };
        if (haState.state === 'on') newState.on = true;
        else if (haState.state === 'off') newState.on = false;
        
        await syncDeviceStateUseCase(deviceId, newState, 'manual-ha-refresh', {
          deviceRepository: this.container.repositories.deviceRepository,
          eventPublisher: { publish: async () => {} },
          activityLogRepository: this.container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        });
        const updated = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(updated));
      } catch (error: unknown) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, error instanceof Error ? error.message : 'Error');
      }
      return;
    }

    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as { roomId?: string };
          if (!payload.roomId) return this.sendError(res, 400, 'Missing roomId');
          const result = await assignDeviceUseCase(assignMatch[1], payload.roomId, 'local-op', 'op-console', {
            deviceRepository: this.container.repositories.deviceRepository,
            eventPublisher: { publish: async () => {} },
            topologyPort: { 
              validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, 
              validateRoomBelongsToHome: async (r, h) => { 
                const room = await this.container.repositories.roomRepository.findRoomById(r); 
                if (!room) throw new Error('Room not found');
                if (room.homeId !== h) throw new Error('Home mismatch');
              }
            },
            idGenerator: { generate: () => crypto.randomUUID() }, clock: { now: () => new Date().toISOString() }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
        } catch (error: unknown) {
          const name = error instanceof Error ? error.constructor.name : '';
          const msg = error instanceof Error ? error.message : 'Error';
          let code = 500;
          if (name === 'DeviceNotFoundError' || msg.includes('not found')) code = 404;
          else if (name === 'DeviceAlreadyAssignedError' || msg.includes('assigned')) code = 409;
          this.sendError(res, code, msg);
        }
      });
      return;
    }

    // POST /api/v1/devices/:id/command
    const commandMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/command$/);
    if (commandMatch) {
      let body = ''; req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as { command?: string };
          if (!payload.command || !isValidCommand(payload.command)) return this.sendError(res, 400, 'Invalid or missing command');
          const syncDeps = {
            deviceRepository: this.container.repositories.deviceRepository,
            eventPublisher: { publish: async () => {} },
            activityLogRepository: this.container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() }
          };
          const localDispatcher = new LocalConsoleCommandDispatcher(this.container.repositories.deviceRepository, syncDeps);
          const haDispatcher = new HomeAssistantCommandDispatcher(this.container.adapters.homeAssistantConnectionProvider.getClient(), this.container.repositories.deviceRepository, syncDeps);
          const compositeDispatcher = new CompositeCommandDispatcher(this.container.repositories.deviceRepository, localDispatcher, haDispatcher);
          await executeDeviceCommandUseCase(commandMatch[1], payload.command as DeviceCommandV1, 'local-op', 'op-console', {
            deviceRepository: this.container.repositories.deviceRepository,
            eventPublisher: { publish: async () => {} },
            topologyPort: { validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, validateRoomBelongsToHome: async () => {} },
            dispatcherPort: compositeDispatcher,
            activityLogRepository: this.container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() }
          });
          
          this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

          const upd = await this.container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(upd));
        } catch (error: unknown) {
          const name = error instanceof Error ? error.constructor.name : '';
          let code = 500;
          if (name === 'DeviceNotFoundError') code = 404;
          else if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') code = 400;
          
          if (error instanceof Error && (error.message.includes('Home Assistant') || error.message.includes('fetch'))) {
            this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
          }

          this.sendError(res, code, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }
    this.sendError(res, 404, 'Not Found');
  }

  private async handleHaDiscovery(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const allStates = await this.container.adapters.homeAssistantConnectionProvider.getClient().getAllStates();
      
      this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

      // Filtrar dominios soportados en V1
      const supportedDomains = ['light', 'switch', 'sensor', 'binary_sensor'];
      
      const entities = allStates
        .filter(s => supportedDomains.includes(s.entity_id.split('.')[0]))
        .map(s => ({
          entityId: s.entity_id,
          state: s.state,
          friendlyName: (s.attributes.friendly_name as string) || s.entity_id,
          domain: s.entity_id.split('.')[0]
        }));

      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(entities));
    } catch (error: unknown) {
      this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      this.sendError(res, 502, error instanceof Error ? error.message : 'HA Connection Error');
    }
  }

  private async handleHaImport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}') as { entityId: string; name?: string };
        if (!payload.entityId) return this.sendError(res, 400, 'Missing entityId');

        const db = SqliteDatabaseManager.getInstance(this.dbPath);
        const home = db.prepare('SELECT id FROM homes LIMIT 1').get() as { id: string } | undefined;
        const homeId = home?.id || 'local-home';

        const externalId = `ha:${payload.entityId}`;
        
        // Verificar duplicados
        const existing = await this.container.repositories.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);
        if (existing) return this.sendError(res, 409, 'Device already imported');

        // Consultar detalle en HA para validación y estado inicial
        const haState = await this.container.adapters.homeAssistantConnectionProvider.getClient().getEntityState(payload.entityId);
        
        if (!haState) {
          this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
          return this.sendError(res, 404, 'Entity not found in Home Assistant');
        }

        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const domain = payload.entityId.split('.')[0];
        const deviceId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Mapeo básico de tipo
        let deviceType = 'sensor';
        if (domain === 'light') deviceType = 'light';
        else if (domain === 'switch') deviceType = 'switch';
        else if (domain === 'binary_sensor') deviceType = 'sensor';

        const device = {
          id: deviceId,
          homeId: homeId,
          roomId: null,
          externalId: externalId,
          name: payload.name || (haState.attributes.friendly_name as string) || payload.entityId,
          type: deviceType as 'light' | 'switch' | 'sensor',
          vendor: 'Home Assistant',
          status: 'PENDING' as const,
          lastKnownState: { on: haState.state === 'on' },
          entityVersion: 1,
          createdAt: now,
          updatedAt: now
        };

        await this.container.repositories.deviceRepository.saveDevice(device);

        res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify(device));
      } catch (error: unknown) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, error instanceof Error ? error.message : 'Import Error');
      }
    });
  }

  private sendError(res: http.ServerResponse, code: number, msg: string) {
    res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: msg }));
  }
}
