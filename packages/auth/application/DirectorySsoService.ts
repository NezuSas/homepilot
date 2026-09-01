import type { User } from '../domain/User';
import { AuthService } from './AuthService';
import { DirectorySsoError, DirectorySsoVerifier } from './DirectorySsoVerifier';
import type { DirectoryAccountLink, DirectoryLinkRepository } from './ports/DirectorySsoPorts';

export type DirectorySsoLoginResult = { linked: false } | { linked: true; token: string; user: User };

export class DirectorySsoService {
  constructor(
    private readonly verifier: DirectorySsoVerifier,
    private readonly links: DirectoryLinkRepository,
    private readonly authService: AuthService
  ) {}

  async login(token: string): Promise<DirectorySsoLoginResult> {
    const payload = await this.verifier.verify(token);
    const link = await this.links.findByDirectoryAccountId(payload.directoryAccountId);
    try {
      await this.verifier.consume(payload);
    } catch (error: unknown) {
      if (this.isUsedTokenConstraint(error)) throw new DirectorySsoError('SSO_TOKEN_REPLAYED');
      throw error;
    }
    if (!link) return { linked: false };
const result = await this.authService.createSessionForUserId(link.localUserId);
    if (!result) throw new DirectorySsoError('SSO_TOKEN_INVALID');
    return { linked: true, ...result };
  }

  /** Validates a browser handoff without consuming an assertion for an unlinked account. */
  async prepareBrowserHandoff(token: string): Promise<DirectorySsoLoginResult> {
    const payload = await this.verifier.verify(token);
    const link = await this.links.findByDirectoryAccountId(payload.directoryAccountId);
    if (!link) return { linked: false };
    return this.login(token);
  }
  async linkAfterLocalLogin(token: string, localUserId: string): Promise<void> {
    const payload = await this.verifier.verify(token);
    try {
      await this.links.linkAndConsume(
        payload.directoryAccountId,
        localUserId,
        payload.jti,
        new Date(payload.exp * 1000).toISOString()
      );
    } catch (error: unknown) {
      if (error instanceof Error && /UNIQUE constraint failed: directory_sso_used_tokens\.jti/.test(error.message)) {
        throw new DirectorySsoError('SSO_TOKEN_REPLAYED');
      }
      throw error;
    }
  }

  private isUsedTokenConstraint(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const sqliteError = error as { code?: unknown; message?: unknown };
    const code = typeof sqliteError.code === 'string' ? sqliteError.code : '';
    const message = typeof sqliteError.message === 'string' ? sqliteError.message : '';
    return code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || /UNIQUE constraint failed: directory_sso_used_tokens\.jti/.test(message);
  }
  async listLinks(localUserId: string): Promise<DirectoryAccountLink[]> {
    return this.links.listByLocalUserId(localUserId);
  }

  async unlink(directoryAccountId: string, localUserId: string): Promise<boolean> {
    return this.links.delete(directoryAccountId, localUserId);
  }
}