import { SqliteUserRepository } from '../infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from '../infrastructure/SqliteSessionRepository';
import { CryptoService } from '../infrastructure/CryptoService';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { UserRole } from '../domain/User';

export interface PublicUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarDataUri: string | null;
  role: 'admin' | 'parent' | 'child' | 'guest' | 'operator';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasActiveSessions: boolean;
}

export interface CreateUserPayload {
  username: string;
  passwordPlain: string;
  role: 'admin' | 'parent' | 'child' | 'guest' | 'operator';
}

export class UserManagementService {
  constructor(
    private readonly userRepository: SqliteUserRepository,
    private readonly sessionRepository: SqliteSessionRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly cryptoService: CryptoService
  ) {}

  private static readonly VALID_ROLES = new Set<string>(['admin', 'parent', 'child', 'guest', 'operator']);

  public async listUsers(): Promise<PublicUserDto[]> {
    const users = await this.userRepository.findAll();
    const dtos: PublicUserDto[] = [];
    
    for (const u of users) {
      const liveSessions = await this.sessionRepository.countActiveForUser(u.id);
      dtos.push({
        id: u.id,
        username: u.username,
        displayName: u.displayName ?? null,
        avatarDataUri: u.avatarDataUri ?? null,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        hasActiveSessions: liveSessions > 0
      });
    }
    
    return dtos;
  }

  public async createUser(adminUserId: string, payload: CreateUserPayload): Promise<PublicUserDto> {
    if (!payload.username || payload.username.trim().length === 0) {
      throw new Error('INVALID_INPUT: Username cannot be empty');
    }
    if (!payload.passwordPlain || payload.passwordPlain.length < 8) {
      throw new Error('INVALID_INPUT: Password must be at least 8 characters long');
    }
    if (!UserManagementService.VALID_ROLES.has(payload.role)) {
      throw new Error('INVALID_ROLE');
    }

    const cleanUsername = payload.username.trim();
    const existing = await this.userRepository.findByUsername(cleanUsername);
    if (existing) {
      throw new Error('USERNAME_TAKEN');
    }

    const passwordHash = await this.cryptoService.hashPassword(payload.passwordPlain);
    const newUserId = this.cryptoService.generateId();
    const now = new Date().toISOString();

    const newUser = {
      id: newUserId,
      username: cleanUsername,
      passwordHash: passwordHash,
      role: payload.role as UserRole,
      isActive: true,
      displayName: null,
      avatarDataUri: null,
      createdAt: now,
      updatedAt: now
    };

    await this.userRepository.seedInitialAdmin(newUser); // Can be reused for any user insertion

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_CREATED' as any,
      timestamp: now,
      description: 'A new organizational user was created',
      data: {
        adminActorUserId: adminUserId,
        targetUserId: newUserId,
        newRole: newUser.role,
        newIsActive: true
      }
    });

    return {
      id: newUser.id,
      username: newUser.username,
      displayName: null,
      avatarDataUri: null,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
      hasActiveSessions: false
    };
  }

  public async updateProfile(
    userId: string,
    displayName: string | null,
    avatarDataUri: string | null
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    await this.userRepository.updateProfile(userId, displayName, avatarDataUri);
  }

  public async updateUserRole(adminUserId: string, targetUserId: string, newRole: 'admin' | 'parent' | 'child' | 'guest' | 'operator'): Promise<void> {
    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');
    if (!UserManagementService.VALID_ROLES.has(newRole)) throw new Error('INVALID_ROLE');
    // Atomic update with Minimum Admin Rule enforcement at DB level
    const success = await this.userRepository.updateRoleAtomic(targetUserId, newRole);
    if (!success) {
      throw new Error('MINIMUM_ADMINS_VIOLATED: Cannot demote the last active admin');
    }

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_ROLE_CHANGED' as any,
      timestamp: new Date().toISOString(),
      description: 'User access role was modified',
      data: {
        adminActorUserId: adminUserId,
        targetUserId,
        previousRole: target.role,
        newRole
      }
    });
  }

  public async setUserActiveState(adminUserId: string, targetUserId: string, isActive: boolean): Promise<void> {
    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');
    // Atomic deactivation with Minimum Admin Rule enforcement
    const success = await this.userRepository.updateActiveStateAtomic(targetUserId, isActive);
    if (!success) {
      if (adminUserId === targetUserId) {
        throw new Error('CANNOT_DEACTIVATE_SELF_LAST_ADMIN');
      } else {
        throw new Error('MINIMUM_ADMINS_VIOLATED');
      }
    }
    
    let revokedSessionsCount = 0;
    if (!isActive) {
      revokedSessionsCount = await this.sessionRepository.deleteAllUserSessions(targetUserId);
    }

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: (isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED') as any,
      timestamp: new Date().toISOString(),
      description: "User account was " + (isActive ? "activated" : "deactivated"),
      data: {
        adminActorUserId: adminUserId,
        targetUserId,
        newIsActive: isActive,
        revokedSessionsCount
      }
    });
  }

  public async revokeUserSessions(adminUserId: string, targetUserId: string): Promise<void> {
    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');

    const revokedSessionsCount = await this.sessionRepository.deleteAllUserSessions(targetUserId);

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_SESSIONS_REVOKED' as any,
      timestamp: new Date().toISOString(),
      description: 'User sessions were administratively revoked',
      data: {
        adminActorUserId: adminUserId,
        targetUserId,
        revokedSessionsCount
      }
    });
  }

  public async resetUserPassword(
    adminUserId: string,
    targetUserId: string,
    newPasswordPlain: string
  ): Promise<void> {
    if (adminUserId === targetUserId) {
      throw new Error('SELF_PASSWORD_CHANGE_REQUIRED');
    }
    if (!newPasswordPlain || newPasswordPlain.length < 8) {
      throw new Error('INVALID_INPUT: Password must be at least 8 characters long');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');

    const passwordHash = await this.cryptoService.hashPassword(newPasswordPlain);
    await this.userRepository.updatePassword(targetUserId, passwordHash);
    const revokedSessionsCount = await this.sessionRepository.deleteAllUserSessions(targetUserId);

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_PASSWORD_RESET',
      timestamp: new Date().toISOString(),
      description: 'User password was reset by an administrator',
      data: {
        adminActorUserId: adminUserId,
        targetUserId,
        revokedSessionsCount,
      },
    });
  }
}
