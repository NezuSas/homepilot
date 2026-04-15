import * as http from 'http';
import { BootstrapContainer } from '../../bootstrap';
import { RouteHandler } from './RouteHandler';

/**
 * ApiGateway — thin HTTP gateway that delegates to modular route handlers.
 * Replaces the monolithic OperatorConsoleServer while preserving the same
 * public API contract (same port, same start/stop methods, same CORS).
 */
export class ApiGateway {
  private readonly server: http.Server;
  private readonly port: number;

  constructor(
    private readonly container: BootstrapContainer,
    private readonly dbPath: string,
    private readonly handlers: RouteHandler[],
    port: number = 3000
  ) {
    this.port = port;
    this.server = http.createServer((req, res) => this.route(req, res));
  }

  public start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[ApiGateway] API local en http://localhost:${this.port}`);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const { url = '', method = 'GET' } = req;
    const pathname = new URL(url, `http://${req.headers.host || 'localhost'}`).pathname;

    for (const handler of this.handlers) {
      const claimed = await handler.handle(req, res, pathname, method, this.container);
      if (claimed) return;
    }

    // 404 fallback — no handler claimed this request
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Not Found',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}
