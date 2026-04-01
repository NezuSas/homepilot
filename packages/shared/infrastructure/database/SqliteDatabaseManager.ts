import Database, { Database as SqliteDatabase } from 'better-sqlite3';

/**
 * SqliteDatabaseManager
 * 
 * Responsable de gestionar la conexión única a la base de datos SQLite local.
 */
export class SqliteDatabaseManager {
  private static instance: SqliteDatabase | null = null;

  /**
   * Obtiene la conexión a la base de datos.
   * 
   * @param dbPath - Ruta al archivo .db de SQLite.
   * @param verbose - Si es true, activa el log de sentencias SQL (útil para debug).
   * @returns Instancia activa de better-sqlite3.
   */
  public static getInstance(dbPath: string, verbose: boolean = false): SqliteDatabase {
    if (!this.instance) {
      this.instance = new Database(dbPath, {
        verbose: verbose ? console.log : undefined,
      });
      
      // Optimizaciones recomendadas para SQLite en Edge (miniPC)
      this.instance.pragma('journal_mode = WAL'); 
      this.instance.pragma('foreign_keys = ON'); 
    }
    return this.instance;
  }

  /**
   * Cierra la conexión de forma segura y resetea el singleton.
   */
  public static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}
