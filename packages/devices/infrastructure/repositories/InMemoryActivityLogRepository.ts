import { ActivityDeletionOptions, ActivityLogRepository, ActivityRecord } from '../../domain/repositories/ActivityLogRepository';

/**
 * Adaptador de persistencia en memoria para el log de actividad.
 * Implementa una estrategia de almacenamiento volátil cronológica (LIFO).
 */
export class InMemoryActivityLogRepository implements ActivityLogRepository {
  private logs: ActivityRecord[] = [];

  async saveActivity(record: ActivityRecord): Promise<void> {
    // Inserción inmutable asegurando la pureza de los snapshots de auditoría
    const frozenRecord = Object.freeze({ 
      ...record,
      data: Object.freeze({ ...record.data }) 
    });
    this.logs.unshift(frozenRecord); // LIFO: El más reciente al principio
  }

  async findRecentByDeviceId(deviceId: string, limit: number): Promise<ReadonlyArray<ActivityRecord>> {
    const deviceLogs = this.logs
      .filter(record => record.deviceId === deviceId)
      .slice(0, limit);
    
    return Object.freeze([...deviceLogs]);
  }

  async findAllRecent(limit: number): Promise<ReadonlyArray<ActivityRecord>> {
    return Object.freeze([...this.logs.slice(0, limit)]);
  }

  async findAllByTypes(types: string[], since: string): Promise<ReadonlyArray<ActivityRecord>> {
    const filtered = this.logs.filter(log => 
      types.includes(log.type) && log.timestamp >= since
    );
    return Object.freeze([...filtered]);
  }

  async deleteOlderThan(cutoff: string, options: ActivityDeletionOptions): Promise<number> {
    const removable = this.logs.filter((log) =>
      log.timestamp < cutoff
      && (!options.types || options.types.includes(log.type))
      && !(options.excludeTypes?.includes(log.type)));
    const doomed = new Set(removable.slice(0, Math.max(0, options.limit)));
    this.logs = this.logs.filter((log) => !doomed.has(log));
    return doomed.size;
  }

  /**
   * Método de utilidad para purga de estados en suites de pruebas unitarias.
   */
  clear(): void {
    this.logs = [];
  }
}
