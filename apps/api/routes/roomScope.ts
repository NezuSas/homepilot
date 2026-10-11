import type { RequestUser } from '../../../packages/shared/domain/http';
import { canUseRoom, isRoomRestricted } from '../../../packages/auth/domain/roomAccess';
import type { Scene } from '../../../packages/devices/domain/Scene';

/** Finds the device a scene action points at; only the room matters here. */
export interface SceneDeviceLookup {
  findDeviceById(deviceId: string): Promise<{ roomId: string | null } | null>;
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
