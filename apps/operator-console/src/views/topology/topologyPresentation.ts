export interface TopologyHome {
  id: string;
  name: string;
  ownerId: string;
}

export interface TopologyRoom {
  id: string;
  name: string;
  homeId: string;
}

export function filterTopologyRooms(rooms: TopologyRoom[], search: string): TopologyRoom[] {
  const normalized = search.trim().toLocaleLowerCase();
  return [...rooms]
    .filter(room => !normalized || room.name.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}
