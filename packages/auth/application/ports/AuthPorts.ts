import { Session } from '../../domain/Session';
import { User } from '../../domain/User';

/** Puertos de autenticación requeridos por los casos de uso locales. */
export interface AuthUserRepository {
  count(): Promise<number>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  seedInitialAdmin(admin: User): Promise<void>;
}

export interface AuthSessionRepository {
  createSession(session: Session): Promise<void>;
  getSessionByToken(token: string): Promise<Session | null>;
  deleteSession(token: string): Promise<void>;
  deleteAllUserSessions(userId: string): Promise<number>;
}

export interface AuthCryptoService {
  generateSessionToken(): string;
  generateId(): string;
  generateStrongRandomPassword(): string;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, storedHashFull: string): Promise<boolean>;
}