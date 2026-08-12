import { SystemVariableService } from '../application/SystemVariableService';
import type { SystemVariable, VariableScope } from '../domain/SystemVariable';
import type { SetVariablePayload, SystemVariableRepository } from '../domain/SystemVariableRepository';

function createRepository(): SystemVariableRepository {
  const variables = new Map<string, SystemVariable>();
  const keyFor = (scope: VariableScope, homeId: string | null, name: string) => `${scope}:${homeId ?? 'global'}:${name}`;

  return {
    async upsert(payload: SetVariablePayload, idGenerator: () => string): Promise<SystemVariable> {
      const key = keyFor(payload.scope, payload.homeId, payload.name);
      const existing = variables.get(key);
      const now = '2026-08-11T00:00:00.000Z';
      const variable: SystemVariable = {
        id: existing?.id ?? idGenerator(),
        scope: payload.scope,
        homeId: payload.homeId,
        name: payload.name,
        value: payload.value,
        valueType: payload.valueType,
        description: payload.description ?? null,
        ttlSeconds: payload.ttlSeconds ?? null,
        expiresAt: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      variables.set(key, variable);
      return variable;
    },
    async findByKey(scope, homeId, name) {
      return variables.get(keyFor(scope, homeId, name)) ?? null;
    },
    async findById(id) {
      return [...variables.values()].find((variable) => variable.id === id) ?? null;
    },
    async listAll(filter) {
      return [...variables.values()].filter((variable) =>
        (!filter?.scope || variable.scope === filter.scope) &&
        (filter?.homeId === undefined || variable.homeId === filter.homeId)
      );
    },
    async delete(id) {
      const entry = [...variables.entries()].find(([, variable]) => variable.id === id);
      if (!entry) return false;
      variables.delete(entry[0]);
      return true;
    },
    async deleteExpired() {
      return 0;
    },
  };
}

describe('Feature: System variables', () => {
  const createService = () => new SystemVariableService(createRepository(), { generate: () => 'generated-id' });

  it('Scenario: Given two homes When they store the same key Then their values remain isolated by scope', async () => {
    const service = createService();
    await service.set({ scope: 'home', homeId: 'home-a', name: 'night_mode', value: 'true', valueType: 'boolean' });
    await service.set({ scope: 'home', homeId: 'home-b', name: 'night_mode', value: 'false', valueType: 'boolean' });

    await expect(service.getTypedValue('home', 'home-a', 'night_mode')).resolves.toBe(true);
    await expect(service.getTypedValue('home', 'home-b', 'night_mode')).resolves.toBe(false);
  });

  it('Scenario: Given an invalid variable payload When it is stored Then the service rejects it before persistence', async () => {
    const service = createService();

    await expect(service.set({ scope: 'home', name: 'mode', value: 'on', valueType: 'string' })).rejects.toThrow('HOME_SCOPED_VARIABLE_REQUIRES_HOME_ID');
    await expect(service.set({ scope: 'global', name: 'settings', value: '{bad json}', valueType: 'json' })).rejects.toThrow('INVALID_JSON_VALUE');
    await expect(service.set({ scope: 'global', name: 'ttl', value: 'active', valueType: 'string', ttlSeconds: 0 })).rejects.toThrow('TTL_MUST_BE_POSITIVE');
  });

  it('Scenario: Given typed stored values When they are read Then the service deserializes their declared types', async () => {
    const service = createService();
    await service.set({ scope: 'global', name: 'limit', value: '42', valueType: 'number' });
    await service.set({ scope: 'global', name: 'profile', value: '{"enabled":true}', valueType: 'json' });

    await expect(service.getTypedValue('global', null, 'limit')).resolves.toBe(42);
    await expect(service.getTypedValue('global', null, 'profile')).resolves.toEqual({ enabled: true });
  });

  it('Scenario: Given a configured timezone When the runtime timezone differs Then the configured timezone wins', async () => {
    const service = createService();
    await service.set({ scope: 'global', name: 'system_timezone', value: 'America/Guayaquil', valueType: 'string' });
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'UTC';

    try {
      await expect(service.getSystemTimezone()).resolves.toBe('America/Guayaquil');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('Scenario: Given an existing variable When it is deleted Then later reads return no value', async () => {
    const service = createService();
    const variable = await service.set({ scope: 'global', name: 'temporary', value: 'value', valueType: 'string' });

    await expect(service.delete(variable.id)).resolves.toBe(true);
    await expect(service.get('global', null, 'temporary')).resolves.toBeNull();
  });
});