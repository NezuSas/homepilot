import type { RequestUser } from '../../../packages/shared/domain/http';
import { canUseRoom, isRoomRestricted } from '../../../packages/auth/domain/roomAccess';
import type { Scene } from '../../../packages/devices/domain/Scene';

/** Finds the device a scene action points at; only the room matters here. */
export interface SceneDeviceLookup {
  findDeviceById(deviceId: string): Promise<{ roomId: string | null } | null>;
}

/** Reads every device of a home once, so a listing does not query per scene action. */
export interface HomeDeviceLookup {
  findAllByHomeId(homeId: string): Promise<ReadonlyArray<{ id: string; roomId: string | null }>>;
}

/**
 * Builds the room lookup for a whole home in one query.
 *
 * Checking a listing action by action meant one query per action of every scene — 160 for twenty scenes
 * of eight actions — and only a room-restricted user paid it, which is exactly the household tablet.
 * A device the home does not contain stays absent, so the caller still denies it.
 */
export async function homeRoomIndex(devices: HomeDeviceLookup, homeId: string): Promise<SceneDeviceLookup> {
  const roomByDeviceId = new Map<string, string | null>();
  for (const device of await devices.findAllByHomeId(homeId)) roomByDeviceId.set(device.id, device.roomId);
  return {
    findDeviceById: async (deviceId: string) =>
      (roomByDeviceId.has(deviceId) ? { roomId: roomByDeviceId.get(deviceId) ?? null } : null),
  };
}

/** True when the user may see a device or room that sits in `roomId`. */
export function roomVisibleTo(user: RequestUser, roomId: string | null | undefined): boolean {
  return canUseRoom(user, roomId);
}

/**
 * A user limited to some rooms only sees and runs scenes whose every action targets a device in those rooms,
 * so a scene can never be used to reach a room the user was not given.
 */
export async function sceneWithinRoomScope(scene: Scene, user: RequestUser, devices: SceneDeviceLookup): Promise<boolean> {
  if (!isRoomRestricted(user)) return true;
  for (const action of scene.actions) {
    const device = await devices.findDeviceById(action.deviceId);
    if (!device || !canUseRoom(user, device.roomId)) return false;
  }
  return true;
}
