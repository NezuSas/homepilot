import type { AccessScope } from './roomAccess';

/**
 * UserRole — HomePilot role hierarchy (highest → lowest privilege).
 *
 *  admin   → Technical superuser. Full access to everything including system config.
 *  parent  → Home owner. Manages devices, automations, scenes, energy. No system config.
 *  child   → Family member. Controls devices and dashboards. No config or advanced views.
 *  guest   → Temporary visitor. Basic device control only (lights, climate). Read-mostly.
 *  operator → Legacy role kept for existing accounts; behaves like parent and is no longer offered for new users.
 */
export type UserRole = 'admin' | 'parent' | 'child' | 'guest' | 'operator';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  displayName: string | null;
  avatarDataUri: string | null;
  /** Absent on accounts created before room access existed: they use the whole home. */
  accessScope?: AccessScope;
  roomIds?: string[];
  /** ISO date after which a child or guest account stops working; null or absent means never. */
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
