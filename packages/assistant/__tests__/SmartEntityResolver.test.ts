import { SmartEntityResolver } from '../application/SmartEntityResolver';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';

const device = (id: string, name: string, type: Device['type'], roomId: string | null = 'room-1'): Device => ({ id, homeId: 'home-1', roomId, externalId: `ha:${type}.${id}`, name, type, vendor: 'HA', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '' });
const room = (id: string, name: string): Room => ({ id, homeId: 'home-1', name, entityVersion: 1, createdAt: '', updatedAt: '' });
const scene = (id: string, name: string): Scene => ({ id, homeId: 'home-1', roomId: null, name, actions: [], createdAt: '', updatedAt: '' });

function resolver(devices: Device[] = [], rooms: Room[] = [], scenes: Scene[] = [], alias: string | null = null, used: string[] = []) {
  return new SmartEntityResolver(
    { findAll: jest.fn().mockResolvedValue(devices) } as never,
    { findAll: jest.fn().mockResolvedValue(rooms) } as never,
    { findAll: jest.fn().mockResolvedValue(scenes) } as never,
    {} as never,
    { getAlias: jest.fn().mockResolvedValue(alias) } as never,
    { getMostUsedDevices: jest.fn().mockResolvedValue(used.map((entityId) => ({ entityId }))) } as never,
  );
}

describe('SmartEntityResolver', () => {
  it('resolves device aliases, normalized exact names, and room types', async () => {
    const light = device('light-1', 'Luz Sala', 'light');
    const sw = device('switch-1', 'Interruptor Sala', 'switch');
    await expect(resolver([light], [], [], 'light-1').resolveDevice('Mi Lámpara', 'user-1')).resolves.toEqual(expect.objectContaining({ type: 'single', match: expect.objectContaining({ entity: light, reason: 'alias' }) }));
    await expect(resolver([light]).resolveDevice('luz sála!', 'user-1')).resolves.toEqual(expect.objectContaining({ type: 'single', match: expect.objectContaining({ reason: 'exact' }) }));
    await expect(resolver([light, sw]).resolveDevice('enciende la luz', 'user-1', 'room-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ entity: light, reason: 'room_match' }) }));
    await expect(resolver([light, sw]).resolveDevice('activa interruptor', 'user-1', 'room-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ entity: sw, reason: 'room_match' }) }));
  });

  it('resolves a token, learned preference, ambiguity, and no result', async () => {
    const kitchen = device('kitchen', 'Luz Cocina', 'light');
    const dining = device('dining', 'Luz Comedor', 'light');
    await expect(resolver([kitchen]).resolveDevice('enciende cocina', 'user-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ reason: 'token' }) }));
    await expect(resolver([kitchen, dining], [], [], null, ['dining']).resolveDevice('enciende luz', 'user-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ entity: dining, reason: 'learned_preference' }) }));
    await expect(resolver([kitchen, dining]).resolveDevice('enciende luz', 'user-1')).resolves.toEqual(expect.objectContaining({ type: 'multiple' }));
    await expect(resolver([kitchen]).resolveDevice('televisor', 'user-1')).resolves.toEqual({ type: 'none' });
  });

  it('resolves rooms and scenes by exact/token match or returns none', async () => {
    const living = room('living', 'Sala Principal');
    const dining = room('dining', 'Sala Comedor');
    const office = room('office', 'Oficina Principal');
    await expect(resolver([], [living]).resolveRoom('sala principal')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ reason: 'exact' }) }));
    await expect(resolver([], [living, office]).resolveRoom('ir a sala principal y oficina principal')).resolves.toEqual(expect.objectContaining({ type: 'multiple' }));
    await expect(resolver([], [living]).resolveRoom('garage')).resolves.toEqual({ type: 'none' });
    const movie = scene('movie', 'Modo Cine');
    await expect(resolver([], [], [movie]).resolveScene('modo cine', 'user-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ reason: 'exact' }) }));
    await expect(resolver([], [], [movie]).resolveScene('activa modo cine ahora', 'user-1')).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ reason: 'token' }) }));
    await expect(resolver([], [], [movie]).resolveScene('apagado', 'user-1')).resolves.toEqual({ type: 'none' });
  });
});