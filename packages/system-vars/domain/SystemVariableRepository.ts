import { SystemVariable, VariableScope } from './SystemVariable';

export interface SetVariablePayload {
  scope: VariableScope;
  homeId: string | null;
  name: string;
  value: string;
  valueType: SystemVariable['valueType'];
  description?: string | null;
  /** When set, the variable is automatically expired after this many seconds. */
  ttlSeconds?: number | null;
}

export interface SystemVariableRepository {
  /** Create or update a variable identified by (scope, homeId, name). */
  upsert(payload: SetVariablePayload, idGenerator: () => string): Promise<SystemVariable>;

  /** Find a single variable by its (scope, homeId, name) key. Returns null if not found or expired. */
  findByKey(
    scope: VariableScope,
    homeId: string | null,
    name: string
  ): Promise<SystemVariable | null>;

  /** Find a single variable by its primary key (id). Returns null if not found or expired. */
  findById(id: string): Promise<SystemVariable | null>;

  /** List all non-expired variables. Optionally filter by scope and/or homeId. */
  listAll(filter?: { scope?: VariableScope; homeId?: string }): Promise<SystemVariable[]>;

  /** Hard-delete a variable by id. Returns true if a row was deleted. */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all variables whose expiresAt is in the past.
   * Should be called periodically for maintenance (lazy TTL enforcement).
   */
  deleteExpired(): Promise<number>;
}
