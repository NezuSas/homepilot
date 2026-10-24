import { BRAND } from './packages/shared/config/brand';
import 'dotenv/config';
import * as path from 'path';
import { bootstrap } from './bootstrap';
import { OperatorConsoleServer } from './apps/api/OperatorConsoleServer';
import { getDatabasePath } from './packages/shared/config/getDatabasePath';
import { CloudGatewayConnector } from './packages/cloud-gateway/infrastructure/CloudGatewayConnector';
import { EdgeGatewayRelayExecutor } from './packages/cloud-gateway/application/EdgeGatewayRelayExecutor';
import { DeviceIdentityError } from './packages/cloud-gateway/application/DeviceIdentityProvider';
import { createDeviceIdentityDiagnosticServer } from './apps/api/DeviceIdentityDiagnosticServer';
import { ActivityLogRetentionService } from './packages/system-observability/application/ActivityLogRetentionService';

/**
 * Punto de entrada principal (Entrypoint Edge) 
 * Orquesta la secuencia real de arranque de la aplicación usando el bootstrap reutilizable.
 */
async function main(): Promise<void> {
  console.log(`[Main] Iniciando proceso ${BRAND.productName} Edge...`);
  
  try {
    // 1. Ejecución del Bootstrap que garantiza persistencia y migraciones
    const container = await bootstrap({ verbose: false });
    
    // 2. El arranque Domain/Application/API se integraría aquí recibiendo 'container'
    console.log(`[Main] Container asegurado. Repositorios listos: ${Object.keys(container.repositories).length}`);
    
    // 3. Levantar Endpoint REST Minimalista para Operator Console V1
    const dbPath = getDatabasePath();
    const server = new OperatorConsoleServer(container, dbPath, 3000);
    server.start();
    if (process.env.NODE_ENV !== 'test') {
      container.services.modbusService.start();
      const stopModbus = (): void => { void container.services.modbusService.stop(); };
      process.once('SIGINT', stopModbus);
      process.once('SIGTERM', stopModbus);
    }

    if (process.env.NODE_ENV !== 'test') {
      // The activity log would otherwise grow without limit (see specs/activity-log-retention-v1.md).
      const activityRetention = new ActivityLogRetentionService(container.repositories.activityLogRepository, {
        onError: (error) => console.error('[ActivityLogRetention] Pass failed:', error instanceof Error ? error.message : error),
      });
      activityRetention.start();
      process.once('SIGINT', () => activityRetention.stop());
      process.once('SIGTERM', () => activityRetention.stop());
    }

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

/**
 * Un error que nadie atiende termina el proceso sin dejar rastro de por qué. No se silencia —el estado
 * del proceso ya no es fiable y Docker lo reinicia—, pero sí se registra con su causa para poder
 * diagnosticarlo después, en lugar de encontrar solo un contenedor reiniciado.
 */
function reportFatal(kind: string, cause: unknown): never {
  const detail = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ''}` : String(cause);
  console.error(`[Main] ${kind} sin atender; el proceso termina y el runtime lo reiniciará: ${detail}`);
  process.exit(1);
}

process.on('uncaughtException', (error: Error) => reportFatal('Excepción', error));
process.on('unhandledRejection', (reason: unknown) => reportFatal('Promesa rechazada', reason));

// Invocación inicial
main();
