import { User, UserRole } from '../../domain/User';

export interface UserManagementUserRepository {
  findAll(): Promise<User[]>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  seedInitialAdmin(user: User): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateRoleAtomic(id: string, role: UserRole): Promise<boolean>;
  updateActiveStateAtomic(id: string, isActive: boolean): Promise<boolean>;
  updateProfile(id: string, displayName: string | null, avatarDataUri: string | null): Promise<void>;
}

export interface UserManagementSessionRepository {
  countActiveForUser(userId: string): Promise<number>;
  deleteAllUserSessions(userId: string): Promise<number>;
}

export interface UserManagementCryptoService {
  hashPassword(password: string): Promise<string>;
  generateId(): string;
}