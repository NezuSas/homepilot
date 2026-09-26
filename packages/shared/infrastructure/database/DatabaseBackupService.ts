import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Database, { Database as SqliteDatabase } from 'better-sqlite3';
import { getDatabasePath } from '../../config/getDatabasePath';
import { logRuntimeDiagnostic } from '../../config/runtimeEnvironment';

export interface BackupInfo {
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export class DatabaseBackupService {
  private readonly backupDir: string;

  constructor() {
    this.backupDir = this.resolveBackupDir();
  }

  private resolveBackupDir(): string {
    const envDir = process.env.HOMEPILOT_BACKUP_DIR;
    if (envDir) {
      return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
    }

    const isProd = process.env.NODE_ENV === 'production';
    return isProd 
      ? '/app/backups' 
      : path.resolve(process.cwd(), 'backups');
  }

  private removePartialArtifacts(partialPath: string, includeDatabase: boolean): void {
    const paths = includeDatabase
      ? [partialPath, `${partialPath}-wal`, `${partialPath}-shm`]
      : [`${partialPath}-wal`, `${partialPath}-shm`];
    const failures: string[] = [];

    for (const artifact of paths) {
      try {
        fs.rmSync(artifact, { force: true });
      } catch (error: unknown) {
        logRuntimeDiagnostic('error', '[DatabaseBackupService] Error removing temporary backup artifact:', error);
        failures.push(path.basename(artifact));
      }
    }

    if (failures.length > 0) {
      throw new Error(`Failed to remove temporary SQLite backup artifacts: ${failures.join(', ')}`);
    }
  }

  /**
   * Crea un backup manual de la base de datos actual.
   */
  public async createBackup(): Promise<BackupResult> {
    let source: SqliteDatabase | undefined;
    let partialPath: string | undefined;
    try {
      const dbPath = getDatabasePath();
      
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: `Source database not found at ${dbPath}` };
      }

      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').split('Z')[0];
      const filename = `homepilot-backup-${timestamp}-${randomUUID()}.db`;
      const targetPath = path.join(this.backupDir, filename);
      partialPath = `${targetPath}.partial`;

      source = new Database(dbPath, { readonly: true, fileMustExist: true });
      await source.backup(partialPath);

      const verification = new Database(partialPath, { readonly: true, fileMustExist: true });
      try {
        if (verification.pragma('integrity_check', { simple: true }) !== 'ok') {
          throw new Error('SQLite backup integrity check failed');
        }
      } finally {
        verification.close();
      }
      this.removePartialArtifacts(partialPath, false);
      fs.renameSync(partialPath, targetPath);
      partialPath = undefined;

      const stats = fs.statSync(targetPath);

      return {
        success: true,
        backup: {
          filename,
          path: targetPath,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString()
        }
      };
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : String(error);
      if (partialPath) {
        try {
          this.removePartialArtifacts(partialPath, true);
        } catch (cleanupError: unknown) {
          message += `; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
        }
      }
      logRuntimeDiagnostic('error', '[DatabaseBackupService] Error creating backup:', error);
      return { success: false, error: message };
    } finally {
      source?.close();
    }
  }

  /**
   * Lista los backups disponibles ordenados por fecha descendente.
   */
  public async listBackups(): Promise<BackupInfo[]> {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.startsWith('homepilot-backup-') && file.endsWith('.db')) {
          const fullPath = path.join(this.backupDir, file);
          const stats = fs.statSync(fullPath);
          backups.push({
            filename: file,
            path: fullPath,
            sizeBytes: stats.size,
            createdAt: stats.birthtime.toISOString()
          });
        }
      }

      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error: unknown) {
      logRuntimeDiagnostic('error', '[DatabaseBackupService] Error listing backups:', error);
      return [];
    }
  }
}
