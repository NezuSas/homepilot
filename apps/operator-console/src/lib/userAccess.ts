/** Rules for the people of the home: who can be limited to rooms, and how an expiry is chosen and described. */

export type HouseholdRole = 'admin' | 'parent' | 'child' | 'guest';
export type AccessScope = 'all' | 'rooms';
export type ExpiryPreset = 'never' | '1d' | '7d' | '30d' | 'custom';

/** The roles an administrator can hand out. `operator` only survives on accounts that already had it. */
export const SELECTABLE_ROLES: readonly HouseholdRole[] = ['admin', 'parent', 'child', 'guest'];
export const EXPIRY_PRESETS: readonly ExpiryPreset[] = ['never', '1d', '7d', '30d', 'custom'];

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_DAYS: Partial<Record<ExpiryPreset, number>> = { '1d': 1, '7d': 7, '30d': 30 };

/** Only a child or a guest can be limited to some rooms or expire. */
export function canRestrictAccess(role: HouseholdRole): boolean {
  return role === 'child' || role === 'guest';
}

/** A new guest starts with no rooms and a week; a new child starts with the whole home and no expiry. */
export function defaultAccessFor(role: HouseholdRole): { scope: AccessScope; preset: ExpiryPreset } {
  return role === 'guest' ? { scope: 'rooms', preset: '7d' } : { scope: 'all', preset: 'never' };
}

/** `YYYY-MM-DD` of a date in the local calendar, the format a date field uses. */
export function toDateFieldValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The expiry to send for a choice, or `undefined` when a custom date is not usable yet.
 * A chosen day ends at the end of that local day, so "today" or an earlier day is never valid.
 */
export function resolveExpiry(preset: ExpiryPreset, customDate: string, now: number = Date.now()): string | null | undefined {
  if (preset === 'never') return null;
  const days = PRESET_DAYS[preset];
  if (days !== undefined) return new Date(now + days * DAY_MS).toISOString();
  const [year, month, day] = customDate.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const endOfDay = new Date(year, month - 1, day, 23, 59, 0, 0);
  return endOfDay.getTime() > now ? endOfDay.toISOString() : undefined;
}

export interface AccessSummarySource {
  role: HouseholdRole;
  accessScope?: AccessScope;
  roomIds?: string[];
}

export type AccessSummary =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'rooms'; names: string[] };

/** What a person can reach, named for the screen. Rooms that no longer exist are not listed. */
export function describeAccess(user: AccessSummarySource, roomNames: ReadonlyMap<string, string>): AccessSummary {
  if (user.accessScope !== 'rooms' || !canRestrictAccess(user.role)) return { kind: 'all' };
  const names = (user.roomIds ?? []).map((id) => roomNames.get(id)).filter((name): name is string => Boolean(name));
  return names.length > 0 ? { kind: 'rooms', names } : { kind: 'none' };
}

export type ExpiryState = { kind: 'none' } | { kind: 'active'; at: Date } | { kind: 'expired'; at: Date };

export function describeExpiry(expiresAt: string | null | undefined, now: number = Date.now()): ExpiryState {
  if (!expiresAt) return { kind: 'none' };
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return { kind: 'none' };
  return at.getTime() <= now ? { kind: 'expired', at } : { kind: 'active', at };
}
