import path from 'path';

/**
 * Resuelve y valida la ruta de la base de datos de manera centralizada.
 * Asegura que no se creen bases de datos implícitas accidentalmente.
 */
export function getDatabasePath(): string {
  const envPath = process.env.HOMEPILOT_DB_PATH;
  const isDev = process.env.NODE_ENV !== 'production';

  if (!envPath) {
    if (isDev) {
      console.warn('[HomePilot] Using fallback local DB (dev only): homepilot.local.db');
      return path.resolve(process.cwd(), 'homepilot.local.db');
    } else {
      throw new Error('[HomePilot] HOMEPILOT_DB_PATH is required. Refusing to start with implicit database.');
    }
  }

  return path.isAbsolute(envPath)
    ? envPath
    : path.resolve(process.cwd(), envPath);
}
