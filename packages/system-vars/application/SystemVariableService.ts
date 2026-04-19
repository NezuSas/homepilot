import { SystemVariable, VariableScope, deserializeVariableValue } from '../domain/SystemVariable';
import { SystemVariableRepository, SetVariablePayload } from '../domain/SystemVariableRepository';

export interface SetVariableInput {
  scope: VariableScope;
  homeId?: string | null;
  name: string;
  /** Raw string value. Use serializeVariableValue() if you have a typed value. */
  value: string;
  valueType: SystemVariable['valueType'];
  description?: string | null;
  ttlSeconds?: number | null;
}

/**
 * Application service for system variable management.
 *
 * Wraps repository operations with domain validation and exposes
 * the deserializeVariableValue helper for callers that need typed reads.
 */
export class SystemVariableService {
  constructor(
    private readonly repository: SystemVariableRepository,
    private readonly idGenerator: { generate: () => string }
  ) {}

  /**
   * Create or update a variable. Name must be non-empty and not exceed 128 chars.
   * Value must be non-empty. For valueType 'json', the value must be valid JSON.
   */
  async set(input: SetVariableInput): Promise<SystemVariable> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('INVALID_VARIABLE_NAME');
    }
    if (input.name.length > 128) {
      throw new Error('VARIABLE_NAME_TOO_LONG');
    }
    if (input.value === undefined || input.value === null) {
      throw new Error('INVALID_VARIABLE_VALUE');
    }
    if (input.scope === 'home' && !input.homeId) {
      throw new Error('HOME_SCOPED_VARIABLE_REQUIRES_HOME_ID');
    }
    if (input.valueType === 'json') {
      try {
        JSON.parse(input.value);
      } catch {
        throw new Error('INVALID_JSON_VALUE');
      }
    }
    if (input.ttlSeconds !== undefined && input.ttlSeconds !== null && input.ttlSeconds <= 0) {
      throw new Error('TTL_MUST_BE_POSITIVE');
    }

    const payload: SetVariablePayload = {
      scope: input.scope,
      homeId: input.homeId ?? null,
      name: input.name.trim(),
      value: input.value,
      valueType: input.valueType,
      description: input.description ?? null,
      ttlSeconds: input.ttlSeconds ?? null,
    };

    return this.repository.upsert(payload, () => this.idGenerator.generate());
  }

  /**
   * Retrieve a variable by its named key. Returns null if not found or expired.
   */
  async get(
    scope: VariableScope,
    homeId: string | null,
    name: string
  ): Promise<SystemVariable | null> {
    return this.repository.findByKey(scope, homeId, name);
  }

  /**
   * Retrieve a variable by its ID. Returns null if not found or expired.
   */
  async getById(id: string): Promise<SystemVariable | null> {
    return this.repository.findById(id);
  }

  /**
   * Get the deserialized (typed) value of a variable.
   * Returns null if the variable does not exist or is expired.
   */
  async getTypedValue(
    scope: VariableScope,
    homeId: string | null,
    name: string
  ): Promise<string | number | boolean | unknown | null> {
    const variable = await this.repository.findByKey(scope, homeId, name);
    if (!variable) return null;
    return deserializeVariableValue(variable);
  }

  /**
   * List variables. Optionally filter by scope and/or homeId.
   */
  async list(filter?: { scope?: VariableScope; homeId?: string }): Promise<SystemVariable[]> {
    return this.repository.listAll(filter);
  }

  /**
   * Delete a variable by id. Returns true if deleted, false if not found.
   */
  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * Purge expired variables from storage. Returns the count of deleted rows.
   * Call this periodically (e.g. hourly) to avoid unbounded table growth.
   */
  async purgeExpired(): Promise<number> {
    return this.repository.deleteExpired();
  }

  /**
   * Resolve the system-wide timezone.
   * Logic:
   * 1. Explicit 'system_timezone' global variable (Database)
   * 2. Runtime/Env detection (Intl.DateTimeFormat)
   * 3. Fallback to 'UTC'
   */
  async getSystemTimezone(): Promise<string> {
    const tzVar = await this.get('global', null, 'system_timezone');
    if (tzVar && tzVar.value) return tzVar.value;

    // Authority from runtime process environment (e.g., Docker TZ variable)
    if (process.env.TZ) return process.env.TZ;

    // Detection fallback from the homepilot appliance runtime environment
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }
}
