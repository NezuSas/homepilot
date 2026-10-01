import { RepositoryDashboardImportBindingResolver } from '../../../infrastructure/adapters/RepositoryDashboardImportBindingResolver';
import type { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import type { RoomRepository } from '../domain/repositories/RoomRepository';
import type { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import type { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import type { DeviceControlCatalogProvider } from '../../cloud-gateway/application/DeviceControlCatalogProvider';

type CatalogState = 'available' | 'ineligible' | 'missing' | 'stale' | 'error';

function createResolver(catalogState: CatalogState = 'available') {
  const devices = {
    findDeviceById: jest.fn(async (id: string) => id === 'missing-device' ? null : ({
      id,
      homeId: id === 'foreign-device' ? 'home-2' : 'home-1',
      type: id === 'camera-1' ? 'camera' : ['ha-scene', 'scene-capability-only', 'incomplete-ha-scene', 'malformed-external-id'].includes(id) ? 'scene' : 'light',
      semanticType: id === 'camera-1' ? 'camera' : ['ha-scene', 'scene-capability-only', 'incomplete-ha-scene', 'malformed-external-id'].includes(id) ? 'scene' : 'light',
      ...(id === 'ha-scene' ? { externalId: 'ha:scene.volume_up' }
        : id === 'malformed-external-id' ? { externalId: 42 } : {}),
      // Repository entities store capability identity, not API-enriched commands.
      capabilities: id === 'scene-capability-only' ? [{ type: 'scene', name: 'Escena' }]
        : id === 'unknown-capability' ? [{ type: 'not_supported', name: 'Desconocida' }] : [],
    })),
  } as unknown as DeviceRepository;
  const rooms = {
    findRoomById: jest.fn(async (id: string) => id === 'missing-room' ? null : ({
      id, homeId: id === 'foreign-room' ? 'home-2' : 'home-1',
    })),
  } as unknown as RoomRepository;
  const scenes = {
    findSceneById: jest.fn(async (id: string) => ['missing-scene', 'ha-scene', 'scene-capability-only', 'incomplete-ha-scene', 'malformed-external-id', 'incompatible-action', 'unknown-capability'].includes(id) ? null : ({
      id, homeId: id === 'foreign-scene' ? 'home-2' : 'home-1', userId: id === 'other-user-scene' ? 'user-2' : 'user-1',
    })),
  } as unknown as SceneRepository;
  const automations = {
    findById: jest.fn(async (id: string) => id === 'missing-automation' ? null : ({
      id, homeId: id === 'foreign-automation' ? 'home-2' : 'home-1', userId: id === 'other-user-automation' ? 'user-2' : 'user-1',
    })),
  } as unknown as AutomationRuleRepository;
  const catalog = {
    getForDevice: jest.fn(() => {
      if (catalogState === 'error') throw new Error('private catalog failure');
      if (catalogState === 'missing') return null;
      // The provider keeps stale commands visible but marks them non-executable.
      return { commands: [{ key: 'navigate_home', dashboardEligible: catalogState === 'available' }] };
    }),
  } as unknown as DeviceControlCatalogProvider;
  return new RepositoryDashboardImportBindingResolver(devices, rooms, scenes, automations, catalog);
}

describe('RepositoryDashboardImportBindingResolver', () => {
  const authorized = new Set(['home-1']);

  it('keeps compatible devices, rooms, scenes and automations inside an authorized home', async () => {
    const resolver = createResolver();
    await expect(resolver.exists(authorized, { type: 'device', id: 'light-1', cardKind: 'light' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'room', id: 'room-1' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'scene', id: 'scene-1', userId: 'user-1' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'action', id: 'scene-1', cardKind: 'action', userId: 'user-1' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'action', id: 'ha-scene', cardKind: 'action' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'action', id: 'scene-capability-only', cardKind: 'action' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'automation', id: 'automation-1', userId: 'user-1' })).resolves.toBe(true);
  });

  it('tolerates missing Home Assistant metadata on normal and foreign devices', async () => {
    const resolver = createResolver();
    await expect(resolver.exists(authorized, { type: 'device', id: 'light-1', cardKind: 'light' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'device', id: 'foreign-device', cardKind: 'light' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'incomplete-ha-scene', cardKind: 'action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'malformed-external-id', cardKind: 'action' })).resolves.toBe(false);
  });

  it('rejects foreign, missing or kind-incompatible targets without matching by name', async () => {
    const resolver = createResolver();
    await expect(resolver.exists(authorized, { type: 'device', id: 'foreign-device', cardKind: 'light' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'device', id: 'camera-1', cardKind: 'light' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'device', id: 'missing-device', cardKind: 'light' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'room', id: 'foreign-room' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'room', id: 'missing-room' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'scene', id: 'foreign-scene' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'scene', id: 'missing-scene' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'foreign-scene', cardKind: 'action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'missing-scene', cardKind: 'action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'incompatible-action', cardKind: 'action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'action', id: 'unknown-capability', cardKind: 'action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'automation', id: 'foreign-automation' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'automation', id: 'missing-automation' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'scene', id: 'other-user-scene', userId: 'user-1' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'automation', id: 'other-user-automation', userId: 'user-1' })).resolves.toBe(false);
  });

  it('keeps a device action only for an existing dashboard-eligible action key', async () => {
    const resolver = createResolver();
    await expect(resolver.exists(authorized, { type: 'device-action', id: 'light-1', actionKey: 'navigate_home' })).resolves.toBe(true);
    await expect(resolver.exists(authorized, { type: 'device-action', id: 'light-1', actionKey: 'old-action' })).resolves.toBe(false);
    await expect(resolver.exists(authorized, { type: 'device-action', id: 'foreign-device', actionKey: 'navigate_home' })).resolves.toBe(false);
  });

  it.each(['ineligible', 'missing', 'stale', 'error'] as const)(
    'rejects a device action when the catalog is %s', async (catalogState) => {
      const resolver = createResolver(catalogState);
      await expect(resolver.exists(authorized, {
        type: 'device-action', id: 'light-1', actionKey: 'navigate_home',
      })).resolves.toBe(false);
    },
  );
});
