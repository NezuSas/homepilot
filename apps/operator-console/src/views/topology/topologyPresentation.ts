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

export interface TopologyDevice {
  id: string;
  name: string;
  type: string;
  semanticType?: string | null;
  status: string;
  roomId: string | null;
  lastKnownState?: Record<string, unknown> | null;
}

export function isActiveTopologyDevice(device: TopologyDevice): boolean {
  const state = device.lastKnownState || {};
  return state.on === true || state.state === 'on' || Number(state.brightness) > 0 || Number(state.power) > 0;
}

export function isTopologyLight(device: TopologyDevice): boolean {
  return device.semanticType?.toLowerCase() === 'light' || device.type.toLowerCase() === 'light';
}

export function getTopologyDeviceTypeKey(device: TopologyDevice): string {
  return device.semanticType?.toLowerCase() || device.type.toLowerCase();
}

export function filterTopologyRooms(rooms: TopologyRoom[], search: string): TopologyRoom[] {
  const normalized = search.trim().toLocaleLowerCase();
  return [...rooms]
    .filter(room => !normalized || room.name.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

export function sortTopologyLights(devices: TopologyDevice[], search: string): TopologyDevice[] {
  const normalized = search.trim().toLocaleLowerCase();
  return [...devices]
    .filter(device => !normalized || device.name.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftActive = isActiveTopologyDevice(left);
      const rightActive = isActiveTopologyDevice(right);
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
}
