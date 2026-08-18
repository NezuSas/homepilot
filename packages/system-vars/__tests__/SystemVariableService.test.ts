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
  it('Scenario: Given service operations When listing, deleting and purging Then repository results are preserved', async () => {
    const service = createService();
    const first = await service.set({ scope: 'global', name: 'first', value: 'one', valueType: 'string', description: 'Description', ttlSeconds: 10 });
    await service.set({ scope: 'home', homeId: 'home-a', name: 'second', value: 'two', valueType: 'string' });

    await expect(service.getById(first.id)).resolves.toEqual(expect.objectContaining({ description: 'Description', ttlSeconds: 10 }));
    await expect(service.list({ scope: 'global' })).resolves.toHaveLength(1);
    await expect(service.list({ homeId: 'home-a' })).resolves.toHaveLength(1);
    await expect(service.delete('missing')).resolves.toBe(false);
    await expect(service.purgeExpired()).resolves.toBe(0);
  });

  it('Scenario: Given malformed names or absent values When setting Then no repository mutation is attempted', async () => {
    const service = createService();
    await expect(service.set({ scope: 'global', name: '', value: 'value', valueType: 'string' })).rejects.toThrow('INVALID_VARIABLE_NAME');
    await expect(service.set({ scope: 'global', name: 'x'.repeat(129), value: 'value', valueType: 'string' })).rejects.toThrow('VARIABLE_NAME_TOO_LONG');
    await expect(service.set({ scope: 'global', name: 'value', value: undefined as never, valueType: 'string' })).rejects.toThrow('INVALID_VARIABLE_VALUE');
  });

  it('Scenario: Given no stored timezone When runtime TZ is configured Then it is returned before environment detection', async () => {
    const service = createService();
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Lima';
    try {
      await expect(service.getSystemTimezone()).resolves.toBe('America/Lima');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
describe('SystemVariableService timezone fallback contract', () => {
  const clearRuntimeTimezone = () => {
    const previousTimezone = process.env.TZ;
    delete process.env.TZ;
    return () => {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    };
  };

  it('uses the detected non-UTC timezone when no persisted or environment timezone is available', async () => {
    const restoreTimezone = clearRuntimeTimezone();
    const dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      resolvedOptions: () => ({ timeZone: 'America/Bogota' }),
    }) as never);

    try {
      await expect(new SystemVariableService(createRepository(), { generate: () => 'generated-id' }).getSystemTimezone())
        .resolves.toBe('America/Bogota');
    } finally {
      dateTimeFormatSpy.mockRestore();
      restoreTimezone();
    }
  });

  it('uses the product fallback when timezone detection is unavailable', async () => {
    const restoreTimezone = clearRuntimeTimezone();
    const dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('timezone unavailable');
    });

    try {
      await expect(new SystemVariableService(createRepository(), { generate: () => 'generated-id' }).getSystemTimezone())
        .resolves.toBe('America/Guayaquil');
    } finally {
      dateTimeFormatSpy.mockRestore();
      restoreTimezone();
    }
  });
});
describe('SystemVariableService UTC fallback contract', () => {
  it('uses the product fallback when runtime detection only yields UTC', async () => {
    const previousTimezone = process.env.TZ;
    delete process.env.TZ;
    const dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      resolvedOptions: () => ({ timeZone: 'UTC' }),
    }) as never);

    try {
      await expect(new SystemVariableService(createRepository(), { generate: () => 'generated-id' }).getSystemTimezone())
        .resolves.toBe('America/Guayaquil');
    } finally {
      dateTimeFormatSpy.mockRestore();
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
describe('SystemVariableService direct lookup contract', () => {
  it('Scenario: Given a stored scoped variable When it is requested through the public get facade Then the exact repository value is returned', async () => {
    const stored = { id: 'variable-1', scope: 'home' as const, homeId: 'home-1', name: 'night_mode', value: 'true', valueType: 'boolean' as const, description: null, ttlSeconds: null, expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const repository = {
      findByKey: jest.fn().mockResolvedValue(stored),
    };
    const service = new SystemVariableService(repository as never, { generate: () => 'generated-id' });

    await expect(service.get('home', 'home-1', 'night_mode')).resolves.toBe(stored);
    expect(repository.findByKey).toHaveBeenCalledWith('home', 'home-1', 'night_mode');
  });
});