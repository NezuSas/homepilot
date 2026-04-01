import { bootstrap } from './bootstrap';

/**
 * Punto de entrada principal (Entrypoint Edge) 
 * Orquesta la secuencia real de arranque de la aplicación usando el bootstrap reutilizable.
 */
async function main(): Promise<void> {
  console.log('[Main] Iniciando proceso HomePilot Edge...');
  
  try {
    // 1. Ejecución del Bootstrap que garantiza persistencia y migraciones
    const container = await bootstrap();
    
    // 2. El arranque Domain/Application/API se integraría aquí recibiendo 'container'
    console.log(`[Main] Container asegurado. Repositorios listos: ${Object.keys(container.repositories).length}`);
    console.log('[Main] El sistema se encuentra preparado para operar.');
    
  } catch (error) {
    console.error('[Main] Fallo catastrófico durante el arranque general:', error);
    process.exit(1);
  }
}

// Invocación inicial
main();
