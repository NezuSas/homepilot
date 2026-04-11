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
import { createRoomUseCase } from '../../packages/topology/application/createRoomUseCase';
import { HomeAssistantState } from '../../packages/devices/infrastructure/adapters/HomeAssistantClient';

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
  private readonly port: number;
  private readonly server: http.Server;

  // Mapa de mensajes seguros para el cliente (Sanitización)
  private static readonly SAFE_MESSAGES: Record<string, string> = {
    'AUTH_FAILED': 'Credenciales inválidas o cuenta desactivada.',
    'UNAUTHORIZED': 'Sesión inválida o expirada.',
    'FORBIDDEN': 'No tiene permisos para realizar esta acción.',
    'NOT_FOUND': 'El recurso solicitado no existe.',
    'VALIDATION_ERROR': 'Los datos proporcionados no son válidos.',
    'HA_CONNECTION_ERROR': 'Error de comunicación con Home Assistant.',
    'HA_AUTH_ERROR': 'Error de autenticación con Home Assistant.',
    'INTERNAL_ERROR': 'Error interno del sistema. Contacte a soporte.',
    'SETUP_REQUIRED': 'El sistema requiere configuración inicial.',
    'ALREADY_INITIALIZED': 'El sistema ya ha sido configurado.',
    'DEVICE_ALREADY_EXISTS': 'El dispositivo ya fue importado.',
    'HA_DISCOVERY_ERROR': 'No se pudo consultar Home Assistant. Verifica la conexión y la configuración.'
  };

  private static readonly DEFAULT_STATUS_CODES: Record<string, number> = {
    'AUTH_FAILED': 401,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'NOT_FOUND': 404,
    'VALIDATION_ERROR': 400,
    'HA_CONNECTION_ERROR': 502,
    'HA_AUTH_ERROR': 502,
    'INTERNAL_ERROR': 500,
    'DEVICE_ALREADY_EXISTS': 409,
    'HA_DISCOVERY_ERROR': 502
  };

  constructor(private readonly container: BootstrapContainer, private readonly dbPath: string, port: number = 3000) {
    this.port = port;
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const { url = '', method = 'GET' } = req;
    const pathname = new URL(url, `http://${req.headers.host || 'localhost'}`).pathname;
    const db = SqliteDatabaseManager.getInstance(this.dbPath);

    // ---------------------------------------------------------
    // PUBLIC HEALTH ENDPOINT (Docker Healthcheck)
    // ---------------------------------------------------------
    if (method === 'GET' && pathname === '/health') {
      this.sendJson(res, { status: 'ok' });
      return;
    }

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
        this.sendJson(res, status);
      } catch (e: any) {
        this.sendError(res, 500, 'SETUP_STATUS_ERROR', e.message);
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
        this.sendJson(res, { success: true });
      } catch (e: any) {
        const msg = e.message;
        let code = 'INTERNAL_ERROR';
        let status = 500;

        if (msg === 'NO_CONFIG') {
          code = 'HA_CONFIG_MISSING';
          status = 400;
        } else if (msg === 'AUTH_ERROR') {
          code = 'HA_AUTH_ERROR';
          status = 400;
        } else if (msg === 'UNREACHABLE') {
          code = 'HA_UNREACHABLE';
          status = 400;
        }

        this.sendError(res, status, code, msg);
      }
      return;
    }

    // -- AUTH V1 ENDPOINTS --
    if (pathname.startsWith('/api/v1/auth/')) {
      if (method === 'POST' && pathname === '/api/v1/auth/login') {
        try {
          const payload = await this.parseBody<{ username?: string; password?: string }>(req);
          if (!payload.username || !payload.password) {
            return this.sendError(res, 400, 'INVALID_INPUT', 'Missing credentials');
          }
          
          const result = await this.container.services.authService.login(payload.username, payload.password);
          
          if (!result) {
            try {
              await this.container.repositories.activityLogRepository.saveActivity({
                deviceId: 'system-auth', 
                type: 'AUTH_FAILED' as any, 
                timestamp: new Date().toISOString(), 
                description: `Failed login attempt for user ${payload.username}`, 
                data: {}
              });
            } catch (err) {
              // Failed to log activity
            }
            return this.sendError(res, 401, 'AUTH_FAILED', 'Invalid credentials');
          }

          try {
            await this.container.repositories.activityLogRepository.saveActivity({
              deviceId: 'system-auth', 
              type: 'AUTH_SUCCESS' as any, 
              timestamp: new Date().toISOString(), 
              description: `User ${result.user.username} logged in`, 
              data: { username: result.user.username }
            });
          } catch (err) {
            // Failed to log activity
          }

          this.sendJson(res, {
            token: result.token,
            user: {
              id: result.user.id,
              username: result.user.username,
              role: result.user.role,
              isActive: result.user.isActive
            }
          });
        } catch (e) {
          this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal Login Error');
        }
        return;
      }

      const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return;

      const authReq = req as any;

      if (method === 'POST' && pathname === '/api/v1/auth/logout') {
        const token = req.headers['authorization']?.replace('Bearer ', '').trim();
        if (token) {
          await this.container.services.authService.logout(token);
        }
        this.sendJson(res, { success: true });
        return;
      }

      if (method === 'GET' && pathname === '/api/v1/auth/me') {
        this.sendJson(res, authReq.user);
        return;
      }

      if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
        try {
          const payload = await this.parseBody<{ currentPassword?: string; newPassword?: string }>(req);
          if (!payload.currentPassword || !payload.newPassword) {
            return this.sendError(res, 400, 'INVALID_INPUT', 'Missing fields');
          }
          
          const result = await this.container.services.authService.changePassword(authReq.user.id, payload.currentPassword, payload.newPassword);
          if (!result.success) return this.sendError(res, 400, 'AUTH_ERROR', 'Failed to change password');
          
          this.sendJson(res, { success: true });
        } catch (e) {
          this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal Change Password Error');
        }
        return;
      }

      this.sendError(res, 404, 'NOT_FOUND', 'Auth route not found');
      return;
    }

    // -- ADMIN: USER MANAGEMENT V2 --
    if (pathname.startsWith('/api/v1/admin/users')) {
      const isProtected = await this.container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return;
      const authReq = req as any;
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;

      // GET /api/v1/admin/users
      if (method === 'GET' && pathname === '/api/v1/admin/users') {
        try {
          const users = await this.container.services.userManagementService.listUsers();
          this.sendJson(res, users);
        } catch (e: any) {
          this.sendError(res, 500, 'USER_LIST_ERROR', e.message);
        }
        return;
      }

      // POST /api/v1/admin/users
      if (method === 'POST' && pathname === '/api/v1/admin/users') {
        try {
          const payload = await this.parseBody<any>(req);
          const result = await this.container.services.userManagementService.createUser(authReq.user.id, payload);
          this.sendJson(res, result, 201);
        } catch (e: any) {
          let code = 'USER_CREATE_ERROR';
          if (e.message.includes('USERNAME_TAKEN')) code = 'USERNAME_TAKEN';
          else if (e.message.includes('INVALID_INPUT')) code = 'INVALID_INPUT';
          this.sendError(res, 400, code, e.message);
        }
        return;
      }

      // PATCH /api/v1/admin/users/:id/role
      const patchRoleMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/role$/);
      if (patchRoleMatch) {
        const targetId = patchRoleMatch[1];
        try {
          const payload = await this.parseBody<{ role: any }>(req);
          await this.container.services.userManagementService.updateUserRole(authReq.user.id, targetId, payload.role);
          this.sendJson(res, { success: true });
        } catch (e: any) {
          let status = 400;
          let code = 'USER_ROLE_ERROR';
          if (e.message.includes('USER_NOT_FOUND')) { status = 404; code = 'USER_NOT_FOUND'; }
          else if (e.message.includes('MINIMUM_ADMINS_VIOLATED')) code = 'MINIMUM_ADMINS_VIOLATED';
          this.sendError(res, status, code, e.message);
        }
        return;
      }

      // PATCH /api/v1/admin/users/:id/active
      const patchActiveMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/active$/);
      if (patchActiveMatch) {
        const targetId = patchActiveMatch[1];
        try {
          const payload = await this.parseBody<{ isActive: boolean }>(req);
          await this.container.services.userManagementService.setUserActiveState(authReq.user.id, targetId, payload.isActive === true);
          this.sendJson(res, { success: true });
        } catch (e: any) {
          let status = 400;
          let code = 'USER_STATUS_ERROR';
          if (e.message.includes('USER_NOT_FOUND')) { status = 404; code = 'USER_NOT_FOUND'; }
          else if (e.message.includes('MINIMUM_ADMINS_VIOLATED')) code = 'MINIMUM_ADMINS_VIOLATED';
          else if (e.message.includes('CANNOT_DEACTIVATE_SELF')) code = 'CANNOT_DEACTIVATE_SELF';
          this.sendError(res, status, code, e.message);
        }
        return;
      }

      // POST /api/v1/admin/users/:id/revoke-sessions
      const revokeMatch = method === 'POST' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/revoke-sessions$/);
      if (revokeMatch) {
        const targetId = revokeMatch[1];
        try {
          await this.container.services.userManagementService.revokeUserSessions(authReq.user.id, targetId);
          this.sendJson(res, { success: true });
        } catch (e: any) {
          this.sendError(res, e.message.includes('USER_NOT_FOUND') ? 404 : 500, 'USER_REVOKE_ERROR', e.message);
        }
        return;
      }

      this.sendError(res, 404, 'NOT_FOUND', 'Admin route not found');
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
        this.sendJson(res, snapshot);
      } catch (error: any) {
        this.sendError(res, 500, 'DIAGNOSTICS_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/system/diagnostics/events
    if (method === 'GET' && pathname === '/api/v1/system/diagnostics/events') {
      try {
        const events = await this.container.services.diagnosticsService.getRecentEvents(50);
        this.sendJson(res, events);
      } catch (error: any) {
        this.sendError(res, 500, 'DIAGNOSTICS_EVENTS_ERROR', error.message);
      }
      return;
    }

    // ---------------------------------------------------------
    // HA SETTINGS ROUTES (Auth required)
    // ---------------------------------------------------------

    // POST /api/v1/settings/test-ha-connection
    // Tests connectivity against HA without persisting. Token is NEVER returned or logged.
    if (method === 'POST' && pathname === '/api/v1/settings/test-ha-connection') {
      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl || !payload.accessToken) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl and accessToken are required');
        }

        const result = await this.container.services.homeAssistantSettingsService.testConnection(
          payload.baseUrl,
          payload.accessToken
        );

        // Return sanitized result — never echo the token back
        this.sendJson(res, {
          success: result.success,
          status: result.status,
          ...(result.success ? {} : { error: { code: result.status.toUpperCase(), message: result.error || 'Connection failed' } })
        });
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to test connection');
      }
      return;
    }

    // POST /api/v1/settings/home-assistant
    // Persists HA baseUrl + token after successful test. Token is stored securely, never returned.
    if (method === 'POST' && pathname === '/api/v1/settings/home-assistant') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;

      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl || !payload.accessToken) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl and accessToken are required');
        }

        await this.container.services.homeAssistantSettingsService.saveSettings(
          payload.baseUrl,
          payload.accessToken
        );

        // Confirm save without echoing token
        this.sendJson(res, { success: true });
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('Invalid URL')) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'Invalid Home Assistant URL');
        }
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to save Home Assistant settings');
      }
      return;
    }

    // GET /api/v1/settings/home-assistant
    // Returns HA config status. Never returns raw token.
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant') {
      try {
        const status = await this.container.services.homeAssistantSettingsService.getStatus();
        // Strip raw token from response — only masked version allowed
        const { ...safeStatus } = status;
        this.sendJson(res, safeStatus);
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to get Home Assistant settings');
      }
      return;
    }

    // GET /api/v1/homes
    if (method === 'GET' && pathname === '/api/v1/homes') {
      try {
        const rows = db.prepare('SELECT * FROM homes').all() as LocalHomeRow[];
        this.sendJson(res, rows.map(r => ({
          id: r.id, ownerId: r.owner_id, name: r.name, entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        })));
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/homes/:id/rooms
    const roomsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (roomsMatch) {
      try {
        const homeId = roomsMatch[1];
        const rows = db.prepare('SELECT * FROM rooms WHERE home_id = ?').all(homeId) as LocalRoomRow[];
        this.sendJson(res, rows.map(r => ({
          id: r.id, homeId: r.home_id, name: r.name, entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        })));
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/homes/:id/rooms
    const createRoomMatch = method === 'POST' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (createRoomMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const homeId = createRoomMatch[1];
        const payload = await this.parseBody<{ name: string }>(req);
        if (!payload.name) return this.sendError(res, 400, 'INVALID_INPUT', 'Room name is required');
        
        const room = await createRoomUseCase(
          payload.name,
          homeId,
          authReq.user.id,
          crypto.randomUUID(),
          {
            homeRepository: this.container.repositories.homeRepository,
            roomRepository: this.container.repositories.roomRepository,
            eventPublisher: { publish: async () => {} },
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() }
          }
        );
        this.sendJson(res, room, 201);
      } catch (error: any) {
        this.sendError(res, 500, 'ROOM_CREATE_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/rooms/:id/action
    const roomActionMatch = method === 'POST' && pathname.match(/^\/api\/v1\/rooms\/([^\/]+)\/action$/);
    if (roomActionMatch) {
      try {
        const roomId = roomActionMatch[1];
        const payload = await this.parseBody<{ action?: string }>(req);
        if (!payload.action || !['turn_on', 'turn_off'].includes(payload.action)) {
          return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid or missing action');
        }

        // Fetch all devices in the room
        const roomDevices = db.prepare('SELECT id, type FROM devices WHERE room_id = ?').all(roomId) as LocalDeviceRow[];
        
        // Filter for controllable devices
        const targetDevices = roomDevices.filter(d => ['light', 'switch'].includes(d.type));

        if (targetDevices.length === 0) {
           this.sendJson(res, { success: true, executed: 0, failed: 0 });
           return;
        }

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

        const executeDeps = {
          deviceRepository: this.container.repositories.deviceRepository,
          eventPublisher: { publish: async () => {} },
          topologyPort: { validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, validateRoomBelongsToHome: async () => {} },
          dispatcherPort: compositeDispatcher,
          activityLogRepository: this.container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        };

        const commandStr = payload.action;

        // Execute sequentially to avoid HA API rate limits or congestion, if needed. 
        // We will execute in parallel but wait for all to settle.
        const results = await Promise.allSettled(
          targetDevices.map(d => 
             executeDeviceCommandUseCase(
               d.id, 
               commandStr, 
               authReq.user.id, 
               'op-console', 
               executeDeps,
               { customDescription: `Room scene ${commandStr} dispatched.` }
             )
          )
        );

        const structuredFailures: { deviceId: string; reason: string }[] = [];
        results.forEach((r, i) => {
           if (r.status === 'rejected') {
             structuredFailures.push({
               deviceId: targetDevices[i].id,
               reason: r.reason instanceof Error ? r.reason.message : String(r.reason)
             });
           }
        });

        const failedCount = structuredFailures.length;
        const totalCount = targetDevices.length;
        const succeededCount = totalCount - failedCount;
        
        const responseBody = {
          success: failedCount === 0,
          total: totalCount,
          succeeded: succeededCount,
          failed: failedCount,
          failures: structuredFailures
        };

        if (failedCount === totalCount) {
          this.sendJson(res, responseBody, 500);
        } else if (failedCount > 0) {
          this.sendJson(res, responseBody, 207);
        } else {
          this.sendJson(res, responseBody, 200);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'ROOM_ACTION_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/scenes
    if (method === 'GET' && pathname === '/api/v1/scenes') {
      try {
        const urlParams = new URL(url, `http://${req.headers.host}`).searchParams;
        let homeId = urlParams.get('homeId');
        if (!homeId) {
          const homes = await this.container.repositories.homeRepository.findHomesByUserId(authReq.user.id);
          if (homes.length > 0) homeId = homes[0].id;
        }
        if (!homeId) return this.sendJson(res, []);
        
        const scenes = await this.container.repositories.sceneRepository.findScenesByHomeId(homeId);
        this.sendJson(res, scenes);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/scenes
    if (method === 'POST' && pathname === '/api/v1/scenes') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const payload = await this.parseBody<any>(req);
        if (!payload.name || !payload.homeId || !Array.isArray(payload.actions)) {
           return this.sendError(res, 400, 'INVALID_INPUT', 'Missing name, homeId, or actions array');
        }
        const newScene = {
          id: crypto.randomUUID(),
          homeId: payload.homeId,
          roomId: payload.roomId || null,
          name: payload.name,
          actions: payload.actions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.container.repositories.sceneRepository.saveScene(newScene);
        this.sendJson(res, newScene, 201);
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_CREATE_ERROR', error.message);
      }
      return;
    }

    // PATCH /api/v1/scenes/:id
    const patchSceneMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)$/);
    if (patchSceneMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const sceneId = patchSceneMatch[1];
        const scene = await this.container.repositories.sceneRepository.findSceneById(sceneId);
        if (!scene) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found');

        const payload = await this.parseBody<any>(req);
        const updated = {
           ...scene,
           name: payload.name ?? scene.name,
           actions: payload.actions ?? scene.actions,
           roomId: payload.roomId !== undefined ? payload.roomId : scene.roomId,
           updatedAt: new Date().toISOString()
        };
        await this.container.repositories.sceneRepository.saveScene(updated);
        this.sendJson(res, updated);
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_UPDATE_ERROR', error.message);
      }
      return;
    }

    // DELETE /api/v1/scenes/:id
    const deleteSceneMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)$/);
    if (deleteSceneMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        await this.container.repositories.sceneRepository.deleteScene(deleteSceneMatch[1]);
        res.writeHead(204).end();
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_DELETE_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/scenes/:id/execute
    const executeSceneMatch = method === 'POST' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)\/execute$/);
    if (executeSceneMatch) {
      try {
        const sceneId = executeSceneMatch[1];
        const scene = await this.container.repositories.sceneRepository.findSceneById(sceneId);
        if (!scene) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found');

        if (scene.actions.length === 0) {
           return this.sendJson(res, { success: true, executed: 0, failed: 0, failures: [] });
        }

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

        const executeDeps = {
          deviceRepository: this.container.repositories.deviceRepository,
          eventPublisher: { publish: async () => {} },
          topologyPort: { validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, validateRoomBelongsToHome: async () => {} },
          dispatcherPort: compositeDispatcher,
          activityLogRepository: this.container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        };

        const results = await Promise.allSettled(
          scene.actions.map(action => 
             executeDeviceCommandUseCase(
               action.deviceId, 
               action.command, 
               authReq.user.id, 
               'op-console', 
               executeDeps,
               { customDescription: `Persistent Scene "${scene.name}" dispatched: ${action.command}` }
             )
          )
        );

        const structuredFailures: { deviceId: string; reason: string }[] = [];
        results.forEach((r, i) => {
           if (r.status === 'rejected') {
             structuredFailures.push({
               deviceId: scene.actions[i].deviceId,
               reason: r.reason instanceof Error ? r.reason.message : String(r.reason)
             });
           }
        });

        const failedCount = structuredFailures.length;
        const totalCount = scene.actions.length;
        const responseBody = {
          success: failedCount === 0,
          total: totalCount,
          succeeded: totalCount - failedCount,
          failed: failedCount,
          failures: structuredFailures
        };

        // Log SCENE_EXECUTED activity
        try {
          await this.container.repositories.activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: 'system',
            type: 'COMMAND_DISPATCHED', // Reuse COMMAND_DISPATCHED or create SCENE_EXECUTED. SCENE_EXECUTED is clearer.
            description: `Scene "${scene.name}" executed by ${authReq.user.username}. (${totalCount - failedCount}/${totalCount} success)`,
            data: {
              sceneId: scene.id,
              sceneName: scene.name,
              userId: authReq.user.id,
              totalActions: totalCount,
              failedActions: failedCount,
              failures: structuredFailures
            }
          });
        } catch (logErr: any) {
          console.error('[OperatorConsoleServer] Failed to log scene execution:', logErr.message);
        }

        if (failedCount === totalCount) {
          this.sendJson(res, responseBody, 500);
        } else if (failedCount > 0) {
          this.sendJson(res, responseBody, 207);
        } else {
          this.sendJson(res, responseBody, 200);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_EXECUTE_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/devices/:id/activity-logs
    const deviceLogsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/activity-logs$/);
    if (deviceLogsMatch) {
      try {
        const deviceId = deviceLogsMatch[1];
        const logs = await this.container.repositories.activityLogRepository.findRecentByDeviceId(deviceId, 20);
        this.sendJson(res, logs);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/devices/:id
    const deviceDetailMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (deviceDetailMatch) {
      try {
        const deviceId = deviceDetailMatch[1];
        const device = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found');
        this.sendJson(res, device);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/devices
    if (method === 'GET' && pathname === '/api/v1/devices') {
      try {
        const rows = db.prepare('SELECT * FROM devices ORDER BY status DESC, created_at DESC').all() as LocalDeviceRow[];
        this.sendJson(res, rows.map(r => ({
          id: r.id, homeId: r.home_id, roomId: r.room_id, externalId: r.external_id, name: r.name, type: r.type, vendor: r.vendor,
          status: r.status, lastKnownState: r.last_known_state ? JSON.parse(r.last_known_state) : null,
          entityVersion: r.entity_version, createdAt: r.created_at, updatedAt: r.updated_at
        })));
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/activity-logs
    if (method === 'GET' && pathname === '/api/v1/activity-logs') {
      try {
        const logs = await this.container.repositories.activityLogRepository.findAllRecent(50);
        this.sendJson(res, logs);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // GET /api/v1/automations
    if (method === 'GET' && pathname === '/api/v1/automations') {
      try {
        const rules = await this.container.repositories.automationRuleRepository.findAll();
        this.sendJson(res, rules);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/automations
    if (method === 'POST' && pathname === '/api/v1/automations') {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const payload = await this.parseBody<CreateAutomationPayload>(req);
        const home = db.prepare('SELECT id FROM homes LIMIT 1').get() as { id: string } | undefined;
        if (!home) return this.sendError(res, 500, 'HOME_NOT_FOUND', 'No local home found');

        const result = await createAutomationRuleUseCase({
          homeId: home.id, userId: authReq.user.id, name: payload.name, trigger: payload.trigger, action: payload.action
        }, {
          automationRuleRepository: this.container.repositories.automationRuleRepository,
          deviceRepository: this.container.repositories.deviceRepository,
          topologyReferencePort: { 
            validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, 
            validateRoomBelongsToHome: async () => {} 
          },
          idGenerator: { generate: () => crypto.randomUUID() }
        });
        this.sendJson(res, result, 201);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, error.message);
      }
      return;
    }

    // PATCH /api/v1/automations/:id
    const patchAutoMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/automations\/([^\/]+)$/);
    if (patchAutoMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      const ruleId = patchAutoMatch[1];
      try {
        const payload = await this.parseBody<UpdateAutomationPayload>(req);
        const ports = { validateHomeOwnership: async () => {}, validateHomeExists: async () => {}, validateRoomBelongsToHome: async () => {} };
        const result = await updateAutomationRuleUseCase(ruleId, authReq.user.id, payload, {
          automationRuleRepository: this.container.repositories.automationRuleRepository,
          deviceRepository: this.container.repositories.deviceRepository,
          topologyReferencePort: ports
        });
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'AUTOMATION_ERROR';
        let status = 500;
        if (name === 'AutomationRuleNotFoundError') { status = 404; code = 'AUTOMATION_NOT_FOUND'; }
        else if (name === 'AutomationLoopError' || name === 'InvalidAutomationRuleError') { status = 400; code = name.toUpperCase(); }
        this.sendError(res, status, code, error.message);
      }
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
          ? await enableAutomationRuleUseCase(ruleId, authReq.user.id, { automationRuleRepository: this.container.repositories.automationRuleRepository, topologyReferencePort: ports })
          : await disableAutomationRuleUseCase(ruleId, authReq.user.id, { automationRuleRepository: this.container.repositories.automationRuleRepository, topologyReferencePort: ports });
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_ERROR', error.message);
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
        await deleteAutomationRuleUseCase(ruleId, authReq.user.id, { 
          automationRuleRepository: this.container.repositories.automationRuleRepository, 
          topologyReferencePort: ports 
        });
        res.writeHead(204).end();
      } catch (error: any) {
        const name = error.constructor.name;
        this.sendError(res, name === 'AutomationRuleNotFoundError' ? 404 : 500, 'AUTOMATION_DELETE_ERROR', error.message);
      }
      return;
    }

    // HA Settings Routes are already handled above (Set 1 canonical). 
    // Legacy/duplicate routes removed.

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
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found');
        if (!device.externalId.startsWith('ha:')) {
          return this.sendError(res, 400, 'INVALID_TYPE', 'Only Home Assistant devices can be refreshed via this endpoint');
        }
        const entityId = device.externalId.split(':')[1];
        const haState = await this.container.adapters.homeAssistantConnectionProvider.getClient().getEntityState(entityId);
        
        if (!haState) {
          this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
          return this.sendError(res, 502, 'HA_UNREACHABLE', 'Could not retrieve state from Home Assistant');
        }
        
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const newState: Record<string, unknown> = { ...device.lastKnownState };
        if (haState.state === 'on') newState.on = true;
        else if (haState.state === 'off') newState.on = false;
        
        await syncDeviceStateUseCase(deviceId, newState, authReq.user.id, {
          deviceRepository: this.container.repositories.deviceRepository,
          eventPublisher: { publish: async () => {} },
          activityLogRepository: this.container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        });
        const updated = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        this.sendJson(res, updated);
      } catch (error: any) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, 'REFRESH_ERROR', error.message);
      }
      return;
    }

    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const payload = await this.parseBody<{ roomId?: string }>(req);
        if (!payload.roomId) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing roomId');
        const result = await assignDeviceUseCase(assignMatch[1], payload.roomId, authReq.user.id, 'op-console', {
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
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        const msg = error.message;
        let code = 'ASSIGN_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError' || msg.includes('not found')) { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'DeviceAlreadyAssignedError' || msg.includes('already assigned')) { status = 409; code = 'ALREADY_ASSIGNED'; }
        this.sendError(res, status, code, msg);
      }
      return;
    }

    // POST /api/v1/devices/:id/command
    const commandMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/command$/);
    if (commandMatch) {
      try {
        const payload = await this.parseBody<{ command?: string }>(req);
        if (!payload.command || !isValidCommand(payload.command)) return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid or missing command');
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
        await executeDeviceCommandUseCase(commandMatch[1], payload.command as DeviceCommandV1, authReq.user.id, 'op-console', {
          deviceRepository: this.container.repositories.deviceRepository,
          eventPublisher: { publish: async () => {} },
          topologyPort: { validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, validateRoomBelongsToHome: async () => {} },
          dispatcherPort: compositeDispatcher,
          activityLogRepository: this.container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        }, {
          allowPendingManualExecution: true
        });
        
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const upd = await this.container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
        this.sendJson(res, upd);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'COMMAND_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') { status = 400; code = 'INVALID_COMMAND'; }
        
        if (error.message.includes('Home Assistant') || error.message.includes('fetch')) {
          this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        }

        this.sendError(res, status, code, error.message);
      }
      return;
    }
    // PATCH /api/v1/devices/:id
    const devicePatchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (devicePatchMatch) {
      if (!this.container.guards.authGuard.requireRole(authReq, res, 'admin')) return;
      try {
        const deviceId = devicePatchMatch[1];
        const payload = await this.parseBody<{ name?: string }>(req);
        
        const device = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found');
        
        // Ownership validation
        const home = await this.container.repositories.homeRepository.findHomeById(device.homeId);
        if (!home || home.ownerId !== authReq.user.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo');
        }
        
        if (payload.name) {
          const updatedDevice = {
            ...device,
            name: payload.name,
            updatedAt: new Date().toISOString(),
            entityVersion: device.entityVersion + 1
          };
          await this.container.repositories.deviceRepository.saveDevice(updatedDevice);
          this.sendJson(res, updatedDevice);
        } else {
          this.sendJson(res, device);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'UPDATE_ERROR', error.message);
      }
      return;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Not Found');
  }

  private async handleHaDiscovery(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    let allStates: HomeAssistantState[] = [];

    // Fase A: Llamada a transporte HA
    try {
      allStates = await this.container.adapters.homeAssistantConnectionProvider.getClient().getAllStates();
      // Si el transporte fue exitoso, marcamos como reachable
      this.container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
    } catch (error: any) {
      // Clasificación de error de transporte
      const errorMsg = error.message || '';
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('auth_invalid');
      const isUnreachable = errorMsg.includes('timeout') || errorMsg.includes('FetchError') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ECONNRESET');

      if (isAuthError) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('auth_error');
      } else if (isUnreachable) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      }
      // Si no es ninguno de los anteriores, mantenemos el estado previo pero reportamos el error de descubrimiento

      return this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error de comunicación con HA: ${error.message}`);
    }

    // Fase B: Procesamiento local y filtrado
    try {
      // Obtener lista de IDs externos ya registrados para Home Assistant
      const existingRows = db.prepare('SELECT external_id FROM devices WHERE external_id LIKE ?').all('ha:%') as { external_id: string }[];
      const existingEntityIds = new Set(existingRows.map(r => r.external_id.replace('ha:', '')));

      const supportedDomains = ['light', 'switch', 'sensor', 'binary_sensor'];
      
      const entities = allStates
        .filter(s => {
          const domain = s.entity_id.split('.')[0];
          return supportedDomains.includes(domain) && !existingEntityIds.has(s.entity_id);
        })
        .map(s => ({
          entityId: s.entity_id,
          state: s.state,
          friendlyName: (s.attributes.friendly_name as string) || s.entity_id,
          domain: s.entity_id.split('.')[0]
        }));

      this.sendJson(res, entities);
    } catch (error: any) {
      // Error en procesamiento local (DB, filtrado, etc.)
      // NO actualizamos el estado de HA, ya que la conexión (Fase A) fue exitosa.
      this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error local de procesamiento: ${error.message}`);
    }
  }

  private async handleHaImport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const authReq = req as any;
    try {
      const payload = await this.parseBody<{ entityId: string; name?: string }>(req);
      if (!payload.entityId) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing entityId');

      const userHomes = await this.container.repositories.homeRepository.findHomesByUserId(authReq.user.id);
      const homeId = userHomes[0]?.id;

      if (!homeId) {
        return this.sendError(res, 404, 'HOME_NOT_FOUND', 'No home found for this user. Onboarding might be incomplete.');
      }

      const externalId = `ha:${payload.entityId}`;
      
      // Verificar duplicados
      const existing = await this.container.repositories.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);
      if (existing) return this.sendError(res, 409, 'DEVICE_ALREADY_EXISTS', 'Device already imported');

      // Consultar detalle en HA para validación y estado inicial
      const haState = await this.container.adapters.homeAssistantConnectionProvider.getClient().getEntityState(payload.entityId);
      
      if (!haState) {
        this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        return this.sendError(res, 404, 'HA_ENTITY_NOT_FOUND', 'Entity not found in Home Assistant');
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

      this.sendJson(res, device, 201);
    } catch (error: any) {
      this.container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      this.sendError(res, 500, 'IMPORT_ERROR', error.message || 'Import Error');
    }
  }

  private async parseBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (e) {
          reject(new Error('INVALID_JSON'));
        }
      });
    });
  }

  private sendJson(res: http.ServerResponse, data: any, status: number = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: http.ServerResponse, status: number, code: string, internalMessage?: string): void {
    const safeMessage = OperatorConsoleServer.SAFE_MESSAGES[code] || OperatorConsoleServer.SAFE_MESSAGES['INTERNAL_ERROR'];
    const finalStatus = status || OperatorConsoleServer.DEFAULT_STATUS_CODES[code] || 500;

    // Log interno profundo para auditoría
    if (internalMessage) {
      console.error(`[API-ERROR] [${code}] ${internalMessage}`);
    }

    res.writeHead(finalStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: { 
        code, 
        message: safeMessage,
        timestamp: new Date().toISOString()
      } 
    }));
  }
}
