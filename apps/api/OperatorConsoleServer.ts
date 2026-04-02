import * as http from 'http';
import * as crypto from 'crypto';
import { BootstrapContainer } from '../../bootstrap';
import { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { assignDeviceUseCase } from '../../packages/devices/application/assignDeviceUseCase';
import { executeDeviceCommandUseCase } from '../../packages/devices/application/executeDeviceCommandUseCase';
import { LocalConsoleCommandDispatcher } from './LocalConsoleCommandDispatcher';

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

/**
 * Servidor de API local para la Operator Console.
 * Proporciona acceso administrativo directo a la topología y dispositivos.
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
      console.log(`[OperatorConsoleServer] API local escuchando en http://localhost:${this.port}`);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS básico para el entorno local
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const { url, method } = req;
    
    // GET /api/v1/homes
    if (method === 'GET' && url === '/api/v1/homes') {
      try {
        const db = SqliteDatabaseManager.getInstance(this.dbPath);
        const rows = db.prepare('SELECT * FROM homes').all() as LocalHomeRow[];
        
        const homes = rows.map(r => ({
          id: r.id,
          ownerId: r.owner_id,
          name: r.name,
          entityVersion: r.entity_version,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(homes));
      } catch (error) {
        console.error('[API] Error in GET /api/v1/homes:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
      return;
    }

    // GET /api/v1/devices
    if (method === 'GET' && url === '/api/v1/devices') {
      try {
        const db = SqliteDatabaseManager.getInstance(this.dbPath);
        const rows = db.prepare('SELECT * FROM devices ORDER BY status DESC, created_at DESC').all() as LocalDeviceRow[];
        
        const devices = rows.map(r => ({
          id: r.id,
          homeId: r.home_id,
          roomId: r.room_id,
          externalId: r.external_id,
          name: r.name,
          type: r.type,
          vendor: r.vendor,
          status: r.status,
          lastKnownState: r.last_known_state ? JSON.parse(r.last_known_state) : null,
          entityVersion: r.entity_version,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(devices));
      } catch (error) {
        console.error('[API] Error in GET /api/v1/devices:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
      return;
    }

    // GET /api/v1/homes/:homeId/rooms
    const roomsMatch = method === 'GET' && url?.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (roomsMatch) {
      const homeId = roomsMatch[1];
      try {
        const home = await this.container.repositories.homeRepository.findHomeById(homeId);
        if (!home) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Home not found' }));
          return;
        }

        const rooms = await this.container.repositories.roomRepository.findRoomsByHomeId(homeId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rooms));
      } catch (error) {
        console.error(`[API] Error in GET /api/v1/homes/${homeId}/rooms:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
      return;
    }

    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && url?.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
      const deviceId = assignMatch[1];
      
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.roomId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing roomId in JSON body' }));
          }

          const topologyPort = {
            validateHomeExists: async (homeId: string) => {
              const home = await this.container.repositories.homeRepository.findHomeById(homeId);
              if (!home) throw new Error('Home not found');
            },
            validateHomeOwnership: async (_homeId: string, _userId: string) => { /* Trust local */ },
            validateRoomBelongsToHome: async (roomId: string, homeId: string) => {
              const room = await this.container.repositories.roomRepository.findRoomById(roomId);
              if (!room) throw new Error('Room not found');
              if (room.homeId !== homeId) throw new Error('Room does not belong to the device home');
            }
          };

          const assignedDevice = await assignDeviceUseCase(
            deviceId,
            payload.roomId,
            'local-operator',
            'op-console-correlation',
            {
              deviceRepository: this.container.repositories.deviceRepository,
              eventPublisher: { publish: async () => {} },
              topologyPort,
              idGenerator: { generate: () => crypto.randomUUID() },
              clock: { now: () => new Date().toISOString() }
            }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(assignedDevice));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const errorName = error instanceof Error ? error.constructor.name : '';
          
          if (errorName === 'DeviceNotFoundError' || msg.includes('Room not found')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
          } else if (errorName === 'DeviceAlreadyAssignedError' || msg.includes('does not belong to the device home')) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
          }
          res.end(JSON.stringify({ error: msg }));
        }
      });
      return;
    }

    // POST /api/v1/devices/:id/command
    const commandMatch = method === 'POST' && url?.match(/^\/api\/v1\/devices\/([^\/]+)\/command$/);
    if (commandMatch) {
      const deviceId = commandMatch[1];
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.command) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing command in JSON body' }));
          }

          const idGenerator = { generate: () => crypto.randomUUID() };
          const clock = { now: () => new Date().toISOString() };
          const eventPublisher = { publish: async () => {} };

          // Inyección del despachador local (simulación de telemetría reactiva)
          const dispatcherPort = new LocalConsoleCommandDispatcher(
            this.container.repositories.deviceRepository,
            {
              deviceRepository: this.container.repositories.deviceRepository,
              eventPublisher,
              activityLogRepository: this.container.repositories.activityLogRepository,
              idGenerator,
              clock
            }
          );

          await executeDeviceCommandUseCase(
            deviceId,
            payload.command,
            'local-operator',
            'op-console-command',
            {
              deviceRepository: this.container.repositories.deviceRepository,
              eventPublisher,
              topologyPort: { 
                validateHomeExists: async () => {}, 
                validateHomeOwnership: async () => {}, 
                validateRoomBelongsToHome: async () => {} 
              },
              dispatcherPort,
              activityLogRepository: this.container.repositories.activityLogRepository,
              idGenerator,
              clock
            }
          );

          // Retornar dispositivo actualizado tras simulación
          const updated = await this.container.repositories.deviceRepository.findDeviceById(deviceId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(updated));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const errorName = error instanceof Error ? error.constructor.name : '';
          
          if (errorName === 'DeviceNotFoundError') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
          } else if (errorName === 'DevicePendingStateError') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
          } else if (errorName === 'InvalidDeviceCommandError' || errorName === 'UnsupportedCommandError') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
          }
          res.end(JSON.stringify({ error: msg }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route Not Found' }));
  }
}
