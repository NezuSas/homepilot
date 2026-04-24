import * as path from 'path';
import { WebSocket } from 'ws';
import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';

describe('WebSocket Authentication Tests', () => {
  let server: OperatorConsoleServer;
  let container: BootstrapContainer;
  const PORT = 3002;
  const DB_PATH = path.resolve(process.cwd(), 'test.ws.db');

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  beforeAll(async () => {
    container = await bootstrap({ dbPath: DB_PATH, verbose: false });
    const db = SqliteDatabaseManager.getInstance(DB_PATH);
    db.exec('DELETE FROM sessions; DELETE FROM users;');
    
    // Create a test user using public service (no private access)
    await container.services.userManagementService.createUser('test-setup', {
      username: 'wstest',
      passwordPlain: 'wsTest123',
      role: 'admin'
    });

    server = new OperatorConsoleServer(container, DB_PATH, PORT);
    server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  async function getValidToken(): Promise<string> {
    const loginResult = await container.services.authService.login('wstest', 'wsTest123');
    if (!loginResult) throw new Error('Login failed for test user');
    return loginResult.token;
  }

  it('rejects WebSocket connection without token', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    
    ws.on('error', (error: unknown) => {
      expect(getErrorMessage(error)).toContain('401');
      done();
    });

    ws.on('open', () => {
      ws.close();
      done(new Error('WebSocket should not have opened without token'));
    });
  });

  it('rejects WebSocket connection with invalid token', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?token=invalid-token`);
    
    ws.on('error', (error: unknown) => {
      expect(getErrorMessage(error)).toContain('401');
      done();
    });

    ws.on('open', () => {
      ws.close();
      done(new Error('WebSocket should not have opened with invalid token'));
    });
  });

  it('accepts WebSocket connection with valid token in query param', async () => {
    const token = await getValidToken();
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws?token=${token}`);
      
      ws.on('open', () => {
        ws.close();
        resolve();
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  });

  it('accepts WebSocket connection with valid token in Authorization header', async () => {
    const token = await getValidToken();
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      ws.on('open', () => {
        ws.close();
        resolve();
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  });
});
