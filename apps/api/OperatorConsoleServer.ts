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

    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
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
          else if (msg.includes('Missing')) code = 400;
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

          const dispatcher = new LocalConsoleCommandDispatcher(this.container.repositories.deviceRepository, {
            deviceRepository: this.container.repositories.deviceRepository,
            eventPublisher: { publish: async () => {} },
            activityLogRepository: this.container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() }
          });

          await executeDeviceCommandUseCase(commandMatch[1], payload.command as DeviceCommandV1, 'local-op', 'op-console', {
            deviceRepository: this.container.repositories.deviceRepository,
            eventPublisher: { publish: async () => {} },
            topologyPort: { validateHomeExists: async () => {}, validateHomeOwnership: async () => {}, validateRoomBelongsToHome: async () => {} },
            dispatcherPort: dispatcher,
            activityLogRepository: this.container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() }
          });
          const upd = await this.container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(upd));
        } catch (error: unknown) {
          const name = error instanceof Error ? error.constructor.name : '';
          let code = 500;
          if (name === 'DeviceNotFoundError') code = 404;
          else if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') code = 400;
          this.sendError(res, code, error instanceof Error ? error.message : 'Error');
        }
      });
      return;
    }

    this.sendError(res, 404, 'Not Found');
  }

  private sendError(res: http.ServerResponse, code: number, msg: string) {
    res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: msg }));
  }
}
