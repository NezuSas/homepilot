import { canAccessRoutine, parseRoutineSharedUsers } from '../domain/routineAccess';

describe('private-by-default routine access', () => {
  it('admits only creator or explicitly shared recipient, never a creatorless resource', () => {
    expect(canAccessRoutine({ userId: 'a' }, 'b')).toBe(false);
    expect(canAccessRoutine({ userId: 'a', sharedUserIds: ['b'] }, 'b')).toBe(true);
    expect(canAccessRoutine({ userId: 'a', sharedUserIds: ['b'] }, 'c')).toBe(false);
    expect(canAccessRoutine({ sharedUserIds: ['b'] }, 'b')).toBe(false);
    expect(canAccessRoutine({ userId: 'a', sharedUserIds: [] }, 'a')).toBe(true);
  });
  it('rejects malformed, duplicate and excessive grants', () => {
    expect(parseRoutineSharedUsers(undefined)).toEqual([]);
    expect(() => parseRoutineSharedUsers('everyone')).toThrow('INVALID_SHARED_USERS');
    expect(() => parseRoutineSharedUsers(['b', 'b'])).toThrow('INVALID_SHARED_USERS');
    expect(() => parseRoutineSharedUsers([''])).toThrow('INVALID_SHARED_USERS');
  });
});
