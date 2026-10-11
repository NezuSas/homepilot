import { User, UserRole } from '../../domain/User';
import type { AccessScope } from '../../domain/roomAccess';

export interface UserManagementUserRepository {
  findAll(): Promise<User[]>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  seedInitialAdmin(user: User): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateRoleAtomic(id: string, role: UserRole): Promise<boolean>;
  updateActiveStateAtomic(id: string, isActive: boolean): Promise<boolean>;
  updateProfile(id: string, displayName: string | null, avatarDataUri: string | null): Promise<void>;
  updateAccess(id: string, scope: AccessScope, roomIds: readonly string[], expiresAt: string | null): Promise<void>;
}

/** Lets the access rules check that a chosen room exists in the home. */
export interface UserManagementRoomLookup {
  findRoomById(id: string): Promise<{ id: string } | null>;
}

export interface UserManagementSessionRepository {
  countActiveForUser(userId: string): Promise<number>;
  deleteAllUserSessions(userId: string): Promise<number>;
}

export interface UserManagementCryptoService {
  hashPassword(password: string): Promise<string>;
  generateId(): string;
}