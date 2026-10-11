import type { UserRole } from './User';

/** Whole home, or only the rooms listed for the user. */
export type AccessScope = 'all' | 'rooms';

/** Only these roles can be limited to some rooms; the rest of the household roles always see the whole home. */
export const ROOM_RESTRICTABLE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['child', 'guest']);

/** Roles that can have an expiry date (a temporary household member). */
export const EXPIRABLE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['child', 'guest']);

export interface RoomScopedSubject {
  readonly role: string;
  readonly accessScope?: AccessScope;
  readonly roomIds?: readonly string[];
}

/** True when the subject may only use the rooms it was given. */
export function isRoomRestricted(subject: RoomScopedSubject): boolean {
  return subject.accessScope === 'rooms' && ROOM_RESTRICTABLE_ROLES.has(subject.role as UserRole);
}

/** A device or room without a room (still in the Inbox) is never visible to a restricted subject. */
export function canUseRoom(subject: RoomScopedSubject, roomId: string | null | undefined): boolean {
  if (!isRoomRestricted(subject)) return true;
  return Boolean(roomId) && (subject.roomIds ?? []).includes(roomId as string);
}

export function isAccountExpired(account: { readonly expiresAt?: string | null }, nowMs: number = Date.now()): boolean {
  if (!account.expiresAt) return false;
  const expiresAtMs = Date.parse(account.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
}
