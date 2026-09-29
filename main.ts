import 'dotenv/config';
import * as path from 'path';
import { bootstrap } from './bootstrap';
import { OperatorConsoleServer } from './apps/api/OperatorConsoleServer';
import { getDatabasePath } from './packages/shared/config/getDatabasePath';
import { CloudGatewayConnector } from './packages/cloud-gateway/infrastructure/CloudGatewayConnector';
import { EdgeGatewayRelayExecutor } from './packages/cloud-gateway/application/EdgeGatewayRelayExecutor';
import { DeviceIdentityError } from './packages/cloud-gateway/application/DeviceIdentityProvider';
import { createDeviceIdentityDiagnosticServer } from './apps/api/DeviceIdentityDiagnosticServer';

/**
 * Punto de entrada principal (Entrypoint Edge) 
 * Orquesta la secuencia real de arranque de la aplicación usando el bootstrap reutilizable.
 */
async function main(): Promise<void> {
  console.log('[Main] Iniciando proceso HomePilot Edge...');
  
  try {
    // 1. Ejecución del Bootstrap que garantiza persistencia y migraciones
    const container = await bootstrap({ verbose: false });
    
    // 2. El arranque Domain/Application/API se integraría aquí recibiendo 'container'
    console.log(`[Main] Container asegurado. Repositorios listos: ${Object.keys(container.repositories).length}`);
    
    // 3. Levantar Endpoint REST Minimalista para Operator Console V1
    const dbPath = getDatabasePath();
    const server = new OperatorConsoleServer(container, dbPath, 3000);
    server.start();

    const cloudGatewayConnector = CloudGatewayConnector.fromEnvironment(
      new EdgeGatewayRelayExecutor({
        homes: container.repositories.homeRepository,        devices: container.repositories.deviceRepository,
        dispatcher: container.adapters.commandDispatcher,
      }),
    );
    cloudGatewayConnector?.start();
    if (cloudGatewayConnector) {
      console.log('[Main] Conector Cloud Edge iniciado.');
      const stopCloudGatewayConnector = (): void => cloudGatewayConnector.stop();
      process.once('SIGINT', stopCloudGatewayConnector);
      process.once('SIGTERM', stopCloudGatewayConnector);
    }

    if (process.env.NODE_ENV !== 'test' && process.env.HOMEPILOT_INTENTFLOW_BASE_URL?.trim()) {
      container.services.manifestSyncService.start();
      const stopManifestSync = (): void => container.services.manifestSyncService.stop();
      process.once('SIGINT', stopManifestSync);
      process.once('SIGTERM', stopManifestSync);
    } else if (process.env.NODE_ENV !== 'test') {
      console.log('[IntentFlow Manifest Sync] no configurado; sincronización deshabilitada.');
    }

    console.log('[Main] El sistema se encuentra preparado para operar.');
    
  } catch (error: unknown) {
    if (error instanceof DeviceIdentityError) {
      console.error('[Main] DEVICE_IDENTITY_INVALID: instalación no lista.');
      createDeviceIdentityDiagnosticServer().listen(3000, process.env.HOMEPILOT_API_BIND_HOST?.trim() || '0.0.0.0');
      return;
    }
    console.error('[Main] Fallo catastrófico durante el arranque general:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Invocación inicial
main();
