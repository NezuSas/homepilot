import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { User, UserRole } from '../domain/User';
import { AccessScope, EXPIRABLE_ROLES, ROOM_RESTRICTABLE_ROLES } from '../domain/roomAccess';
import {
  UserManagementCryptoService,
  UserManagementRoomLookup,
  UserManagementSessionRepository,
  UserManagementUserRepository,
} from './ports/UserManagementPorts';

export interface PublicUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarDataUri: string | null;
  role: 'admin' | 'parent' | 'child' | 'guest' | 'operator';
  isActive: boolean;
  accessScope: AccessScope;
  roomIds: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasActiveSessions: boolean;
}

export interface CreateUserPayload {
  username: string;
  passwordPlain: string;
  role: 'admin' | 'parent' | 'child' | 'guest' | 'operator';
  accessScope?: AccessScope;
  roomIds?: string[];
  expiresAt?: string | null;
}

export interface UserAccessInput {
  accessScope: AccessScope;
  roomIds?: string[];
  expiresAt?: string | null;
}

export interface NormalizedAccess {
  accessScope: AccessScope;
  roomIds: string[];
  expiresAt: string | null;
}

export class UserManagementService {
  constructor(
    private readonly userRepository: UserManagementUserRepository,
    private readonly sessionRepository: UserManagementSessionRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly cryptoService: UserManagementCryptoService,
    private readonly roomLookup?: UserManagementRoomLookup
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
        accessScope: u.accessScope ?? 'all',
        roomIds: u.roomIds ?? [],
        expiresAt: u.expiresAt ?? null,
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
    // Usernames become folder names under /media/users and appear in logs: bound them and refuse path or control characters.
    if (payload.username.trim().length > 40 || /[\u0000-\u001f\\/]/.test(payload.username)) {
      throw new Error('INVALID_INPUT: Username must be at most 40 characters and cannot contain slashes or control characters');
    }
    if (!payload.passwordPlain || payload.passwordPlain.length < 8) {
      throw new Error('INVALID_INPUT: Password must be at least 8 characters long');
    }
    if (!UserManagementService.VALID_ROLES.has(payload.role)) {
      throw new Error('INVALID_ROLE');
    }

    const wantsAccess = payload.accessScope !== undefined || payload.roomIds !== undefined || payload.expiresAt !== undefined;
    const access = wantsAccess
      ? await this.normalizeAccess(payload.role as UserRole, { accessScope: payload.accessScope ?? 'all', roomIds: payload.roomIds, expiresAt: payload.expiresAt })
      : null;

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
    if (access) await this.userRepository.updateAccess(newUserId, access.accessScope, access.roomIds, access.expiresAt);

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_CREATED',
      timestamp: now,
      description: 'A new organizational user was created',
      data: {
        adminActorUserId: adminUserId,
        targetUserId: newUserId,
        newRole: newUser.role,
        newIsActive: true,
        accessScope: access?.accessScope ?? 'all',
        roomCount: access?.roomIds.length ?? 0,
        expiresAt: access?.expiresAt ?? null
      }
    });

    return {
      id: newUser.id,
      username: newUser.username,
      displayName: null,
      avatarDataUri: null,
      role: newUser.role,
      isActive: newUser.isActive,
      accessScope: access?.accessScope ?? 'all',
      roomIds: access?.roomIds ?? [],
      expiresAt: access?.expiresAt ?? null,
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

    // Only a child or a guest can be limited to some rooms or expire: any other role goes back to the whole home.
    if (!ROOM_RESTRICTABLE_ROLES.has(newRole) && (target.accessScope === 'rooms' || target.expiresAt)) {
      await this.userRepository.updateAccess(targetUserId, 'all', [], null);
    }

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_ROLE_CHANGED',
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

  /** Sets which rooms a child or guest can use and when the account stops working. */
  public async updateAccess(adminUserId: string, targetUserId: string, input: UserAccessInput): Promise<NormalizedAccess> {
    const target: User | null = await this.userRepository.findById(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');
    const access = await this.normalizeAccess(target.role, input);

    await this.userRepository.updateAccess(targetUserId, access.accessScope, access.roomIds, access.expiresAt);

    await this.activityLogRepository.saveActivity({
      deviceId: 'user-management',
      type: 'USER_ACCESS_CHANGED',
      timestamp: new Date().toISOString(),
      description: 'User room access or expiry was modified',
      data: {
        adminActorUserId: adminUserId,
        targetUserId,
        previousAccessScope: target.accessScope ?? 'all',
        newAccessScope: access.accessScope,
        roomCount: access.roomIds.length,
        expiresAt: access.expiresAt
      }
    });

    return access;
  }

  private async normalizeAccess(role: UserRole, input: UserAccessInput): Promise<NormalizedAccess> {
    if (input.accessScope !== 'all' && input.accessScope !== 'rooms') {
      throw new Error('INVALID_INPUT: accessScope must be all or rooms');
    }
    if (input.accessScope === 'rooms' && !ROOM_RESTRICTABLE_ROLES.has(role)) {
      throw new Error('INVALID_INPUT: Only a child or a guest can be limited to some rooms');
    }

    const requestedRooms = Array.isArray(input.roomIds) ? input.roomIds : [];
    if (requestedRooms.some((roomId) => typeof roomId !== 'string' || roomId.length === 0)) {
      throw new Error('INVALID_INPUT: roomIds must be room ids');
    }
    const roomIds = input.accessScope === 'rooms' ? [...new Set(requestedRooms)] : [];
    for (const roomId of roomIds) {
      const room = this.roomLookup ? await this.roomLookup.findRoomById(roomId) : null;
      if (!room) throw new Error('INVALID_INPUT: Unknown room');
    }

    let expiresAt: string | null = null;
    if (input.expiresAt !== undefined && input.expiresAt !== null) {
      if (!EXPIRABLE_ROLES.has(role)) throw new Error('INVALID_INPUT: Only a child or a guest can expire');
      const expiresAtMs = typeof input.expiresAt === 'string' ? Date.parse(input.expiresAt) : Number.NaN;
      if (!Number.isFinite(expiresAtMs)) throw new Error('INVALID_INPUT: expiresAt must be a date');
      if (expiresAtMs <= Date.now()) throw new Error('INVALID_INPUT: expiresAt must be in the future');
      expiresAt = new Date(expiresAtMs).toISOString();
    }

    return { accessScope: input.accessScope, roomIds, expiresAt };
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
      type: (isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED'),
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
      type: 'USER_SESSIONS_REVOKED',
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
