/**
 * UserRole — HomePilot role hierarchy (highest → lowest privilege).
 *
 *  admin   → Technical superuser. Full access to everything including system config.
 *  parent  → Home owner. Manages devices, automations, scenes, energy. No system config.
 *  child   → Family member. Controls devices and dashboards. No config or advanced views.
 *  guest   → Temporary visitor. Basic device control only (lights, climate). Read-mostly.
 *  operator → Legacy / technical support role (same as admin for backward compatibility).
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
  createdAt: string;
  updatedAt: string;
}
