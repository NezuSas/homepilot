import { ActivityLogRepository, ActivityRecord } from '../../domain/repositories/ActivityLogRepository';

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

  /**
   * Método de utilidad para purga de estados en suites de pruebas unitarias.
   */
  clear(): void {
    this.logs = [];
  }
}
