/**
 * Domain types for persistent system variables.
 *
 * Variables are scoped to 'global' (cross-home) or 'home' (per-home).
 * They are stored as strings and carry an explicit value_type so consumers
 * can deserialize them correctly without assumptions.
 *
 * TTL: when ttlSeconds is set, the variable expires and will not be returned
 * after expiresAt. Expired variables are cleaned up lazily on read or by a
 * scheduled maintenance call.
 */

export type VariableScope = 'global' | 'home';
export type VariableValueType = 'string' | 'number' | 'boolean' | 'json';

export interface SystemVariable {
  readonly id: string;
  /** Visibility scope. 'global' applies across the system; 'home' is homeId-specific. */
  readonly scope: VariableScope;
  /** Required when scope === 'home'; null for global variables. */
  readonly homeId: string | null;
  /** Unique name within (scope, homeId). */
  readonly name: string;
  /** Raw serialized value. Deserialize according to valueType. */
  readonly value: string;
  readonly valueType: VariableValueType;
  readonly description: string | null;
  /** If set, the variable expires after this many seconds from creation. */
  readonly ttlSeconds: number | null;
  /** ISO 8601 expiry timestamp, computed as createdAt + ttlSeconds. null = no expiry. */
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Typed helper to deserialize a variable's stored string value into its
 * native JavaScript type. Returns null if the stored value is malformed.
 */
export function deserializeVariableValue(
  variable: SystemVariable
): string | number | boolean | unknown | null {
  try {
    switch (variable.valueType) {
      case 'string':
        return variable.value;
      case 'number':
        return Number(variable.value);
      case 'boolean':
        return variable.value === 'true';
      case 'json':
        return JSON.parse(variable.value);
    }
  } catch {
    return null;
  }
}
