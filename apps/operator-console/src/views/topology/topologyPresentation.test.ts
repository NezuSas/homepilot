import { filterTopologyRooms, isActiveTopologyDevice, sortTopologyLights } from './topologyPresentation';

describe('topology presentation', () => {
  it('sorts matching rooms by name without mutating the source', () => {
    const rooms = [{ id: '2', name: 'Sala', homeId: 'h' }, { id: '1', name: 'Baño', homeId: 'h' }];
    expect(filterTopologyRooms(rooms, 'a').map(room => room.name)).toEqual(['Baño', 'Sala']);
    expect(rooms[0].name).toBe('Sala');
  });

  it('places active lights ahead of inactive matching lights', () => {
    const lights = [
      { id: '1', name: 'Alfa', type: 'light', status: 'READY', roomId: 'r', lastKnownState: { on: false } },
      { id: '2', name: 'Beta', type: 'light', status: 'READY', roomId: 'r', lastKnownState: { brightness: 50 } },
    ];
    expect(isActiveTopologyDevice(lights[1])).toBe(true);
    expect(sortTopologyLights(lights, '').map(light => light.id)).toEqual(['2', '1']);
  });
});
