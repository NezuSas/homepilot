import * as fs from 'fs';
import * as path from 'path';
import { Database as SqliteDatabase } from 'better-sqlite3';

/**
 * SqliteMigrationsRunner
 * 
 * Responsable de asegurar que el esquema de la base de datos esté actualizado.
 * Ejecuta archivos .sql en orden secuencial garantizando atomicidad.
 */
export class SqliteMigrationsRunner {
  constructor(private readonly db: SqliteDatabase) {}

  /**
   * Ejecuta todas las migraciones pendientes en el directorio especificado.
   */
  public run(migrationsDir: string): void {
    this.ensureMigrationsTable();

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); 

    const applied = this.getAppliedMigrations();

    for (const file of files) {
      if (!applied.has(file)) {
        this.applyMigration(migrationsDir, file);
      }
    }
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private getAppliedMigrations(): Set<string> {
    const rows = this.db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
    return new Set(rows.map(r => r.name));
  }

  private applyMigration(dir: string, fileName: string): void {
    const filePath = path.join(dir, fileName);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const runMigration = this.db.transaction(() => {
      this.db.exec(sql);
      this.db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(fileName);
    });

    runMigration();
  }
}
