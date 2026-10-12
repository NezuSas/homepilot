import { filterTopologyRooms } from './topologyPresentation';

describe('topology presentation', () => {
  it('sorts matching rooms by name without mutating the source', () => {
    const rooms = [{ id: '2', name: 'Sala', homeId: 'h' }, { id: '1', name: 'Baño', homeId: 'h' }];
    expect(filterTopologyRooms(rooms, 'a').map(room => room.name)).toEqual(['Baño', 'Sala']);
    expect(rooms[0].name).toBe('Sala');
  });
});
