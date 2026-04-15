import * as path from 'path';
import * as http from 'http';
import { BootstrapContainer } from '../../bootstrap';
import { ApiGateway } from './ApiGateway';
import { RouteHandler } from './RouteHandler';
import { AuthRoutes } from './routes/AuthRoutes';
import { AdminRoutes } from './routes/AdminRoutes';
import { SystemRoutes } from './routes/SystemRoutes';
import { AssistantRoutes } from './routes/AssistantRoutes';
import { SettingsRoutes } from './routes/SettingsRoutes';
import { TopologyRoutes } from './routes/TopologyRoutes';
import { SceneRoutes } from './routes/SceneRoutes';
import { AutomationRoutes } from './routes/AutomationRoutes';
import { DeviceRoutes } from './routes/DeviceRoutes';
import { DashboardRoutes } from './routes/DashboardRoutes';

/**
 * OperatorConsoleServer — backward-compatible wrapper around ApiGateway.
 *
 * This class preserves the exact same constructor signature, start(), and stop()
 * methods that main.ts and any tests depend on. Internally it delegates to
 * ApiGateway with all modular route handlers wired.
 *
 * No behavioral change — this is pure indirection.
 */
export class OperatorConsoleServer {
  private gateway: ApiGateway;

  constructor(container: BootstrapContainer, dbPath: string, port: number = 3000) {
    const handlers: RouteHandler[] = [
      new SystemRoutes(),
      new AuthRoutes(),
      new AdminRoutes(),
      new AssistantRoutes(),
      new SettingsRoutes(),
      new TopologyRoutes(dbPath),
      new SceneRoutes(),
      new AutomationRoutes(dbPath),
      new DeviceRoutes(dbPath),
      new DashboardRoutes(),
    ];

    this.gateway = new ApiGateway(container, dbPath, handlers, port);
  }

  public start(): void {
    this.gateway.start();
  }

  public stop(): Promise<void> {
    return this.gateway.stop();
  }
}
