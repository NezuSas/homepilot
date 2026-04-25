import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../../config/getDatabasePath';

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

  /**
   * Crea un backup manual de la base de datos actual.
   */
  public async createBackup(): Promise<BackupResult> {
    try {
      const dbPath = getDatabasePath();
      
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: `Source database not found at ${dbPath}` };
      }

      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').split('Z')[0];
      const filename = `homepilot-backup-${timestamp}.db`;
      const targetPath = path.join(this.backupDir, filename);

      fs.copyFileSync(dbPath, targetPath);

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
      console.error('[DatabaseBackupService] Error creating backup:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
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
      console.error('[DatabaseBackupService] Error listing backups:', error);
      return [];
    }
  }
}
