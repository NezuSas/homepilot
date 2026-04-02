import * as path from 'path';
import { bootstrap } from './bootstrap';
import { OperatorConsoleServer } from './apps/api/OperatorConsoleServer';

/**
 * Punto de entrada principal (Entrypoint Edge) 
 * Orquesta la secuencia real de arranque de la aplicación usando el bootstrap reutilizable.
 */
async function main(): Promise<void> {
  console.log('[Main] Iniciando proceso HomePilot Edge...');
  
  try {
    // 1. Ejecución del Bootstrap que garantiza persistencia y migraciones
    const container = await bootstrap({ verbose: true });
    
    // 2. El arranque Domain/Application/API se integraría aquí recibiendo 'container'
    console.log(`[Main] Container asegurado. Repositorios listos: ${Object.keys(container.repositories).length}`);
    
    // 3. Levantar Endpoint REST Minimalista para Operator Console V1
    const dbPath = process.env.HOMEPILOT_DB_PATH || path.join(__dirname, 'homepilot.local.db');
    const server = new OperatorConsoleServer(container, dbPath, 3000);
    server.start();

    console.log('[Main] El sistema se encuentra preparado para operar.');
    
  } catch (error: unknown) {
    console.error('[Main] Fallo catastrófico durante el arranque general:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Invocación inicial
main();
