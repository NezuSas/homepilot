/** Read/execute permission only. Administration always requires the creator. */
export function canAccessRoutine(resource: { userId?: string; sharedUserIds?: readonly string[] } | null | undefined, userId: string): boolean {
  return !!resource?.userId && (resource.userId === userId || !!resource.sharedUserIds?.includes(userId));
}

export function parseRoutineSharedUsers(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 200 || raw.some(id => typeof id !== 'string' || !id.trim()) || new Set(raw).size !== raw.length) {
    throw new Error('INVALID_SHARED_USERS');
  }
  return raw as string[];
}
