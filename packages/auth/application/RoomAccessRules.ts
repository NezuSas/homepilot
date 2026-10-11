import { canUseRoom, isRoomRestricted, type RoomScopedSubject } from '../domain/roomAccess';

/** Looks up where a device lives; `exists: false` means there is no such device. */
export interface DeviceRoomLookup {
  findDeviceRoom(deviceId: string): Promise<{ exists: boolean; roomId: string | null }>;
}

export type RoomAccessCheck = (user: RoomScopedSubject, pathname: string) => Promise<boolean>;

const API_PREFIX = ['', 'api', 'v1'];

/**
 * One rule for every request that carries a device or room id in its path, so a user limited to some
 * rooms cannot reach the rest of the home through any route. Lists are filtered by the routes that build them.
 * A device that does not exist is refused like one out of scope: it never confirms what is there.
 */
export function createRoomAccessCheck(lookup: DeviceRoomLookup): RoomAccessCheck {
  return async (user, pathname) => {
    if (!isRoomRestricted(user)) return true;
    const segments = pathname.split('/');
    if (API_PREFIX.some((part, index) => segments[index] !== part)) return true;
    const area = segments[3];
    const id = segments[4];

    // Routines are managed by the family roles, never by someone limited to some rooms.
    if (area === 'automations') return false;
    if (area === 'rooms' && id) return canUseRoom(user, decodeURIComponent(id));
    if (area === 'devices' && id) {
      const device = await lookup.findDeviceRoom(decodeURIComponent(id));
      return device.exists && canUseRoom(user, device.roomId);
    }
    return true;
  };
}
