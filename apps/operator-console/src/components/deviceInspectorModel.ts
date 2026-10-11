export const DEVICE_ONLINE_WINDOW_MS = 300000;

/** A device counts as online when it reported within the last five minutes. */
export function isDeviceOnline(updatedAt: string | undefined | null, now: number = Date.now()): boolean {
  return now - new Date(updatedAt || new Date()).getTime() < DEVICE_ONLINE_WINDOW_MS;
}
