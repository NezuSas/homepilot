export interface LocalProfile {
  displayName: string | null;
  avatarDataUri: string | null;
}

export const EMPTY_LOCAL_PROFILE: LocalProfile = { displayName: null, avatarDataUri: null };

/** Profile cached with the session context; empty when absent or unreadable. */
export function readStoredProfile(storage: Pick<Storage, 'getItem'> = localStorage): LocalProfile {
  try {
    const raw = storage.getItem('hp_user_ctx');
    if (raw) {
      const ctx = JSON.parse(raw) as Partial<LocalProfile>;
      return { displayName: ctx.displayName ?? null, avatarDataUri: ctx.avatarDataUri ?? null };
    }
  } catch { /* ignore */ }
  return EMPTY_LOCAL_PROFILE;
}
