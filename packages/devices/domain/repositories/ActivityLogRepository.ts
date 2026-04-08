/**
 * Tipos de eventos auditables en el historial de actividad (Observabilidad V1).
 */
export type ActivityType = 
  | 'STATE_CHANGED' 
  | 'COMMAND_DISPATCHED' 
  | 'COMMAND_FAILED' 
  | 'AUTOMATION_FAILED' 
  | 'HA_RESILIENCE'
  | 'USER_CREATED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_SESSIONS_REVOKED';

/**
 * Registro de actividad atómico para persistencia derivada (Read Model).
 */
export interface ActivityRecord {
  readonly timestamp: string;
  readonly deviceId: string;
  readonly type: ActivityType;
  readonly description: string;
  readonly data: Record<string, unknown>;
}

/**
 * Puerto de Salida (Outbound Port) para la persistencia del log de actividad.
 * Representa un Read Model derivado para fines de observabilidad y auditoría.
 */
export interface ActivityLogRepository {
  /**
   * Registra una nueva entrada en el historial de actividad.
   */
  saveActivity(record: ActivityRecord): Promise<void>;

  /**
   * Recupera las entradas más recientes para un dispositivo específico.
   * Debe garantizar ordenación cronológica descendente (LIFO).
   */
  findRecentByDeviceId(deviceId: string, limit: number): Promise<ReadonlyArray<ActivityRecord>>;

  /**
   * Recupera las entradas más recientes de todo el sistema.
   * Debe garantizar ordenación cronológica descendente (LIFO).
   */
  findAllRecent(limit: number): Promise<ReadonlyArray<ActivityRecord>>;
}
