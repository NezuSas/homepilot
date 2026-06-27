import { User, UserRole } from '../domain/User';
import { Session } from '../domain/Session';
import { SqliteUserRepository } from '../infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from '../infrastructure/SqliteSessionRepository';
import { CryptoService } from '../infrastructure/CryptoService';

export class AuthService {
  // Session lifespan: 7 days
  private static readonly SESSION_LIFESPAN_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private userRepository: SqliteUserRepository,
    private sessionRepository: SqliteSessionRepository,
    private cryptoService: CryptoService
  ) {}

  private async createSessionForUser(user: User): Promise<{ token: string; user: User }> {
    const token = this.cryptoService.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AuthService.SESSION_LIFESPAN_MS);

    const session: Session = {
      id: token,
      token,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    };

    await this.sessionRepository.createSession(session);

    return { token, user };
  }

  public async login(username: string, passwordPlain: string): Promise<{ token: string; user: User } | null> {
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[AuthService:DevLog] Login attempt for username: ${username}`);
    }

    const user = await this.userRepository.findByUsername(username);
    
    if (isDev) {
      console.log(`[AuthService:DevLog] User found: ${!!user}`);
      if (user) console.log(`[AuthService:DevLog] is_active: ${user.isActive}`);
    }

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await this.cryptoService.verifyPassword(passwordPlain, user.passwordHash);
    
    if (isDev) {
      console.log(`[AuthService:DevLog] Password match: ${isValid}`);
    }

    if (!isValid) {
      return null;
    }

    return this.createSessionForUser(user);
  }

  public async logout(token: string): Promise<void> {
    await this.sessionRepository.deleteSession(token);
  }

  public async verifyToken(token: string): Promise<{ isValid: boolean; user: User | null; reason?: 'expired' | 'inactive' | 'not_found' }> {
    const session = await this.sessionRepository.getSessionByToken(token);
    
    if (!session) {
      return { isValid: false, user: null, reason: 'not_found' };
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return { isValid: false, user: null, reason: 'expired' };
    }

    const user = await this.userRepository.findById(session.userId);
    
    if (!user) {
      return { isValid: false, user: null, reason: 'not_found' };
    }

    if (!user.isActive) {
      return { isValid: false, user: null, reason: 'inactive' };
    }

    return { isValid: true, user };
  }

  /**
   * Post-login explicit change password capability
   */
  public async changePassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean }> {
    if (newPasswordPlain.length < 8) return { success: false };
    const user = await this.userRepository.findById(userId);
    if (!user) return { success: false };

    const isCurrentValid = await this.cryptoService.verifyPassword(currentPasswordPlain, user.passwordHash);
    if (!isCurrentValid) return { success: false };

    const newHash = await this.cryptoService.hashPassword(newPasswordPlain);
    await this.userRepository.updatePassword(userId, newHash);
    
    // Revoke all existing sessions so they have to login with new password everywhere
    await this.sessionRepository.deleteAllUserSessions(userId);

    return { success: true };
  }

  public async getBootstrapAdmin(isDevBootstrap: boolean): Promise<{ admin: User; generatedPlaintext: string | null } | null> {
    const count = await this.userRepository.count();
    
    if (count > 0) {
      return null; // Do not bootstrap if users exist
    }

    let generatedPlaintext: string | null = null;
    let passwordPlain: string;

    if (isDevBootstrap) {
      passwordPlain = 'admin';
    } else {
      generatedPlaintext = this.cryptoService.generateStrongRandomPassword();
      passwordPlain = generatedPlaintext;
    }

    const passwordHash = await this.cryptoService.hashPassword(passwordPlain);
    const now = new Date().toISOString();

    const admin: User = {
      id: 'admin-local-edge',
      username: 'admin',
      passwordHash: passwordHash,
      role: 'admin',
      isActive: true,
      displayName: null,
      avatarDataUri: null,
      createdAt: now,
      updatedAt: now
    };

    await this.userRepository.seedInitialAdmin(admin);

    return { admin, generatedPlaintext };
  }

  public async bootstrapFirstAdmin(payload: {
    username: string;
    password: string;
    displayName?: string | null;
  }): Promise<{ token: string; user: User } | null> {
    const count = await this.userRepository.count();
    if (count > 0) {
      return null;
    }

    const username = payload.username.trim();
    const password = payload.password;
    const displayName = payload.displayName?.trim() || null;

    if (username.length < 3 || username.length > 40) {
      throw new Error('INVALID_USERNAME');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      throw new Error('INVALID_USERNAME');
    }

    if (password.length < 10) {
      throw new Error('WEAK_PASSWORD');
    }

    const passwordHash = await this.cryptoService.hashPassword(password);
    const now = new Date().toISOString();

    const admin: User = {
      id: this.cryptoService.generateId(),
      username,
      passwordHash,
      role: 'admin',
      isActive: true,
      displayName,
      avatarDataUri: null,
      createdAt: now,
      updatedAt: now
    };

    await this.userRepository.seedInitialAdmin(admin);

    return this.createSessionForUser(admin);
  }
}
