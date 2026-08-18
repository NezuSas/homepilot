import { UserManagementService } from '../packages/auth/application/UserManagementService';
import { UserRole } from '../packages/auth/domain/User';

describe('UserManagementService (Deep Audit & Atomic Security)', () => {
  let service: UserManagementService;
  let mockUserRepo: any;
  let mockSessionRepo: any;
  let mockActivityRepo: any;
  let mockCrypto: any;

  beforeEach(() => {
    mockUserRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      countActiveAdmins: jest.fn(),
      updateRoleAtomic: jest.fn(),
      updateActiveStateAtomic: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
      seedInitialAdmin: jest.fn(),
    };
    mockSessionRepo = {
      countActiveForUser: jest.fn().mockResolvedValue(1),
      deleteAllUserSessions: jest.fn().mockResolvedValue(2),
    };
    mockActivityRepo = {
      saveActivity: jest.fn().mockResolvedValue(undefined),
    };
    mockCrypto = {
      hashPassword: jest.fn().mockResolvedValue('hashed_pwd'),
      generateId: jest.fn().mockReturnValue('new_uuid'),
    };

    service = new UserManagementService(mockUserRepo, mockSessionRepo, mockActivityRepo, mockCrypto);
  });

  test('listUsers() should return sanitized DTOs without sensitive fields', async () => {
    mockUserRepo.findAll.mockResolvedValue([
      { id: '1', username: 'admin', role: 'admin' as UserRole, isActive: true, createdAt: '...', updatedAt: '...' }
    ]);
    mockSessionRepo.countActiveForUser.mockResolvedValue(5);

    const result = await service.listUsers();
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '1',
      username: 'admin',
      displayName: null,
      avatarDataUri: null,
      role: 'admin',
      isActive: true,
      createdAt: '...',
      updatedAt: '...',
      hasActiveSessions: true
    });
    // PROOF: No password hashes or internal sensitive data
    expect((result[0] as any).passwordHash).toBeUndefined();
  });

  test('updateUserRole() should utilize updateRoleAtomic and handle failure', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'admin1', role: 'admin', isActive: true });
    mockUserRepo.updateRoleAtomic.mockResolvedValue(false); // Simulated atomic violation

    await expect(service.updateUserRole('any', 'admin1', 'operator'))
      .rejects.toThrow('MINIMUM_ADMINS_VIOLATED');
    
    expect(mockUserRepo.updateRoleAtomic).toHaveBeenCalledWith('admin1', 'operator');
  });

  test('setUserActiveState() should utilize updateActiveStateAtomic and handle failure', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'admin1', role: 'admin', isActive: true });
    mockUserRepo.updateActiveStateAtomic.mockResolvedValue(false); // Simulated atomic violation

    await expect(service.setUserActiveState('other-admin', 'admin1', false))
      .rejects.toThrow('MINIMUM_ADMINS_VIOLATED');
    
    expect(mockUserRepo.updateActiveStateAtomic).toHaveBeenCalledWith('admin1', false);
  });

  test('setUserActiveState() should throw specific error for self-deactivation attempt if atomic fails', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'admin1', role: 'admin', isActive: true });
    mockUserRepo.updateActiveStateAtomic.mockResolvedValue(false);

    await expect(service.setUserActiveState('admin1', 'admin1', false))
      .rejects.toThrow('CANNOT_DEACTIVATE_SELF_LAST_ADMIN');
  });

  test('createUser() performs strict validation (trim, length, existence)', async () => {
    mockUserRepo.findByUsername.mockResolvedValue({ id: 'existing' });

    await expect(service.createUser('admin1', {
      username: ' existing ',
      passwordPlain: 'short',
      role: 'operator'
    })).rejects.toThrow('INVALID_INPUT: Password must be at least 8 characters long');

    await expect(service.createUser('admin1', {
      username: 'existing',
      passwordPlain: 'valid_password',
      role: 'operator'
    })).rejects.toThrow('USERNAME_TAKEN');
  });

  test('revokeUserSessions() behaves correctly for self and others', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'admin1' });
    
    // Self revocation
    await service.revokeUserSessions('admin1', 'admin1');
    expect(mockSessionRepo.deleteAllUserSessions).toHaveBeenCalledWith('admin1');

    // Other revocation
    await service.revokeUserSessions('admin1', 'other');
    expect(mockSessionRepo.deleteAllUserSessions).toHaveBeenCalledWith('other');
  });

  test('resetUserPassword() hashes the new password, revokes sessions and writes a safe audit record', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'operator-1', username: 'operator' });

    await service.resetUserPassword('admin-1', 'operator-1', 'secure-password');

    expect(mockCrypto.hashPassword).toHaveBeenCalledWith('secure-password');
    expect(mockUserRepo.updatePassword).toHaveBeenCalledWith('operator-1', 'hashed_pwd');
    expect(mockSessionRepo.deleteAllUserSessions).toHaveBeenCalledWith('operator-1');
    expect(mockActivityRepo.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'USER_PASSWORD_RESET',
      data: expect.objectContaining({
        adminActorUserId: 'admin-1',
        targetUserId: 'operator-1',
        revokedSessionsCount: 2,
      }),
    }));
    expect(JSON.stringify(mockActivityRepo.saveActivity.mock.calls[0][0])).not.toContain('secure-password');
  });

  test('resetUserPassword() rejects self-reset and weak passwords', async () => {
    await expect(service.resetUserPassword('admin-1', 'admin-1', 'secure-password'))
      .rejects.toThrow('SELF_PASSWORD_CHANGE_REQUIRED');
    await expect(service.resetUserPassword('admin-1', 'operator-1', 'short'))
      .rejects.toThrow('INVALID_INPUT');
  });
  test('createUser() persists a sanitized active user and writes an audit record', async () => {
    mockUserRepo.findByUsername.mockResolvedValue(null);

    await expect(service.createUser('admin-1', {
      username: '  guest-user  ', passwordPlain: 'secure-password', role: 'guest'
    })).resolves.toEqual(expect.objectContaining({
      id: 'new_uuid', username: 'guest-user', role: 'guest', isActive: true, hasActiveSessions: false
    }));

    expect(mockUserRepo.seedInitialAdmin).toHaveBeenCalledWith(expect.objectContaining({
      id: 'new_uuid', username: 'guest-user', passwordHash: 'hashed_pwd', role: 'guest', isActive: true
    }));
    expect(mockActivityRepo.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'USER_CREATED', data: expect.objectContaining({ adminActorUserId: 'admin-1', targetUserId: 'new_uuid' })
    }));
  });

  test('updates profiles, roles, and active state while auditing successful changes', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'member-1', role: 'child', isActive: true });
    mockUserRepo.updateRoleAtomic.mockResolvedValue(true);
    mockUserRepo.updateActiveStateAtomic.mockResolvedValue(true);

    await expect(service.updateProfile('member-1', 'Gustavo', 'data:image/png;base64,avatar')).resolves.toBeUndefined();
    await expect(service.updateUserRole('admin-1', 'member-1', 'parent')).resolves.toBeUndefined();
    await expect(service.setUserActiveState('admin-1', 'member-1', false)).resolves.toBeUndefined();
    await expect(service.setUserActiveState('admin-1', 'member-1', true)).resolves.toBeUndefined();

    expect(mockUserRepo.updateProfile).toHaveBeenCalledWith('member-1', 'Gustavo', 'data:image/png;base64,avatar');
    expect(mockSessionRepo.deleteAllUserSessions).toHaveBeenCalledWith('member-1');
    expect(mockActivityRepo.saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'USER_ROLE_CHANGED' }));
    expect(mockActivityRepo.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'USER_DEACTIVATED', data: expect.objectContaining({ revokedSessionsCount: 2 })
    }));
    expect(mockActivityRepo.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'USER_ACTIVATED', data: expect.objectContaining({ revokedSessionsCount: 0 })
    }));
  });

  test('rejects unknown users, invalid roles, and invalid user creation payloads', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(service.updateProfile('missing', null, null)).rejects.toThrow('USER_NOT_FOUND');
    await expect(service.updateUserRole('admin-1', 'missing', 'guest')).rejects.toThrow('USER_NOT_FOUND');
    await expect(service.setUserActiveState('admin-1', 'missing', false)).rejects.toThrow('USER_NOT_FOUND');
    await expect(service.revokeUserSessions('admin-1', 'missing')).rejects.toThrow('USER_NOT_FOUND');
    await expect(service.resetUserPassword('admin-1', 'missing', 'secure-password')).rejects.toThrow('USER_NOT_FOUND');
    await expect(service.createUser('admin-1', { username: ' ', passwordPlain: 'secure-password', role: 'guest' })).rejects.toThrow('INVALID_INPUT');
    await expect(service.createUser('admin-1', { username: 'user', passwordPlain: 'secure-password', role: 'invalid' as UserRole })).rejects.toThrow('INVALID_ROLE');
  });
});
