/**
 * buildDatabase.ts
 *
 * Assembler: inicialización de la base de datos SQLite y aplicación de migraciones.
 * Lanza si las migraciones fallan (fallo fatal que debe detener el arranque).
 */
import * as fs from 'fs';
import * as path from 'path';
import { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../packages/shared/infrastructure/database/SqliteMigrationsRunner';

export interface DatabaseAssembly {
  db: ReturnType<typeof SqliteDatabaseManager.getInstance>;
  dbPath: string;
}

export interface DatabaseBuildOptions {
  rawDbPath: string;
  migrationsDir?: string;
  verbose?: boolean;
}

export function buildDatabase(options: DatabaseBuildOptions): DatabaseAssembly {
  const dbPath = path.isAbsolute(options.rawDbPath)
    ? options.rawDbPath
    : path.resolve(process.cwd(), options.rawDbPath);

  const migrationsDir = options.migrationsDir ??
    (fs.existsSync('/app/migrations')
      ? '/app/migrations'
      : path.resolve(process.cwd(), 'migrations'));

  const isVerbose = options.verbose ?? process.env.NODE_ENV !== 'production';

  console.log(`[Bootstrap] Inicializando persistencia SQLite en: ${dbPath}`);
  const db = SqliteDatabaseManager.getInstance(dbPath, isVerbose);

  console.log(`[Bootstrap] Ejecutando migraciones desde: ${migrationsDir}...`);
  try {
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    console.log('[Bootstrap] Migraciones aplicadas/validadas correctamente.');
  } catch (error) {
    console.error('[Bootstrap] Error fatal al aplicar migraciones. Abortando arranque de repositorios.', error);
    throw error;
  }

  return { db, dbPath };
}
