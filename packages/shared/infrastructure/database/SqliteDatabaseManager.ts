import * as path from 'path';
import Database, { Database as SqliteDatabase } from 'better-sqlite3';

/**
 * SqliteDatabaseManager
 * 
 * Responsable de gestionar las conexiones a base de datos SQLite.
 * Soporta múltiples instancias identificadas por su ruta absoluta.
 */
export class SqliteDatabaseManager {
  private static readonly instances = new Map<string, SqliteDatabase>();

  private static resolveJournalMode(): 'WAL' | 'DELETE' {
    const configuredMode = process.env.HOMEPILOT_SQLITE_JOURNAL_MODE?.trim().toUpperCase();

    if (!configuredMode || configuredMode === 'WAL') return 'WAL';
    if (configuredMode === 'DELETE') return 'DELETE';

    console.warn(
      `[SQLite] HOMEPILOT_SQLITE_JOURNAL_MODE=${configuredMode} is not supported. Falling back to WAL.`
    );
    return 'WAL';
  }

  /**
   * Obtiene la conexión a la base de datos para una ruta específica.
   * 
   * @param dbPath - Ruta al archivo .db de SQLite.
   * @param verbose - Si es true, activa el log de sentencias SQL (útil para debug).
   * @returns Instancia activa de better-sqlite3 para esa ruta.
   */
  public static getInstance(dbPath: string, verbose: boolean = false): SqliteDatabase {
    const fullPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    
    let db = this.instances.get(fullPath);
    if (!db) {
      db = new Database(fullPath, {
        verbose: verbose ? console.log : undefined,
      });
      
      // WAL is ideal for the Linux miniPC. DELETE avoids shared-memory journal
      // files on Docker Desktop bind mounts backed by Windows file systems.
      db.pragma(`journal_mode = ${this.resolveJournalMode()}`);
      db.pragma('foreign_keys = ON'); 
      
      this.instances.set(fullPath, db);
    }
    return db;
  }

  /**
   * Cierra todas las conexiones activas y resetea el pool.
   */
  public static closeAll(): void {
    for (const [path, db] of this.instances.entries()) {
      db.close();
      this.instances.delete(path);
    }
  }

  /**
   * Cierra la conexión de forma segura para una ruta específica.
   */
  public static close(dbPath: string): void {
    const fullPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const db = this.instances.get(fullPath);
    if (db) {
      db.close();
      this.instances.delete(fullPath);
    }
  }
}
