import { Database as SqliteDatabase } from 'better-sqlite3';
import { AutomationRule } from '../../domain/automation/types';
import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

/**
 * Interfaz interna para tipar las filas de la tabla 'automation_rules'.
 */
interface AutomationRuleRow {
  id: string;
  home_id: string;
  user_id: string;
  name: string;
  enabled: number; // 0 o 1
  trigger: string; // JSON
  action: string;  // JSON
  created_at: string;
  updated_at: string;
}

/**
 * SQLiteAutomationRuleRepository
 *
 * Implementación de persistencia local para las reglas de automatización.
 * Diseñado para la ejecución en el Edge.
 */
export class SQLiteAutomationRuleRepository implements AutomationRuleRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  /**
   * Guarda o reemplaza una regla de automatización de forma atómica (upsert).
   * Mapea el estado enabled booleano a un entero (0/1) para SQLite.
   */
  public async save(rule: AutomationRule): Promise<void> {
    const serializedTrigger = this.serializeTrigger(rule.trigger);
    const serializedAction = this.serializeAction(rule.action);
    const isEnabled = rule.enabled ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO automation_rules (
        id, home_id, user_id, name, enabled, trigger, action, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        home_id = excluded.home_id,
        user_id = excluded.user_id,
        name = excluded.name,
        enabled = excluded.enabled,
        trigger = excluded.trigger,
        action = excluded.action,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')
    `);

    stmt.run(
      rule.id,
      rule.homeId,
      rule.userId, // owner context as per schema
      rule.name,
      isEnabled,
      serializedTrigger,
      serializedAction
    );
  }

  /**
   * Busca una regla por ID único.
   */
  public async findById(id: string): Promise<AutomationRule | null> {
    const stmt = this.db.prepare('SELECT * FROM automation_rules WHERE id = ?');
    const row = stmt.get(id) as AutomationRuleRow | undefined;

    if (!row) return null;
    return this.mapToEntity(row);
  }

  /**
   * Encuentra todas las reglas activas que dependen de un dispositivo disparador específico.
   * Filtra utilizando json_extract en SQLite y asegurando que enabled = 1.
   * Mantiene estricta compatibilidad semántica con InMemoryAutomationRuleRepository.
   */
  public async findByTriggerDevice(deviceId: string): Promise<ReadonlyArray<AutomationRule>> {
    const stmt = this.db.prepare(`
      SELECT * FROM automation_rules 
      WHERE json_extract(trigger, '$.deviceId') = ? AND enabled = 1
    `);

    const rows = stmt.all(deviceId) as AutomationRuleRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Lista todas las reglas configuradas para un hogar específico.
   */
  public async findByHomeId(homeId: string): Promise<ReadonlyArray<AutomationRule>> {
    const stmt = this.db.prepare('SELECT * FROM automation_rules WHERE home_id = ?');
    const rows = stmt.all(homeId) as AutomationRuleRow[];
    
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Lista todas las reglas del sistema.
   * Utilizado por la consola del operador local para gestión global.
   */
  public async findAll(): Promise<ReadonlyArray<AutomationRule>> {
    const stmt = this.db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC');
    const rows = stmt.all() as AutomationRuleRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Elimina silenciosamente una regla del sistema por su ID.
   */
  public async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM automation_rules WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Transforma una fila de SQLite a la entidad del dominio AutomationRule.
   */
  private mapToEntity(row: AutomationRuleRow): AutomationRule {
    return {
      id: row.id,
      homeId: row.home_id,
      userId: row.user_id,
      name: row.name,
      enabled: row.enabled === 1,
      trigger: this.deserializeTrigger(row.trigger),
      action: this.deserializeAction(row.action),
    };
  }

  /**
   * Helper privado tipado para serializar el objeto trigger.
   */
  private serializeTrigger(trigger: AutomationRule['trigger']): string {
    return JSON.stringify(trigger);
  }

  /**
   * Helper privado tipado para deserializar el objeto trigger con seguridad de fallos.
   */
  private deserializeTrigger(raw: string): AutomationRule['trigger'] {
    try {
      return JSON.parse(raw) as AutomationRule['trigger'];
    } catch {
      throw new Error(`Falló la deserialización del trigger JSON: ${raw}`);
    }
  }

  /**
   * Helper privado tipado para serializar el objeto action.
   */
  private serializeAction(action: AutomationRule['action']): string {
    return JSON.stringify(action);
  }

  /**
   * Helper privado tipado para deserializar el objeto action con seguridad de fallos.
   */
  private deserializeAction(raw: string): AutomationRule['action'] {
    try {
      return JSON.parse(raw) as AutomationRule['action'];
    } catch {
      throw new Error(`Falló la deserialización de action JSON: ${raw}`);
    }
  }
}
