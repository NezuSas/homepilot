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
});
