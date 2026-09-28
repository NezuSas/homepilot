const COMMAND_TOKEN_TTL_SECONDS = 120;

export interface CommandTokenSource {
  requestCommandToken(): Promise<{ token: string; expiresIn: number }>;
}

export class CommandTokenCacheError extends Error {
  readonly code = 'INTENTFLOW_COMMAND_TOKEN_INVALID';
  constructor() { super('INTENTFLOW_COMMAND_TOKEN_INVALID'); this.name = 'CommandTokenCacheError'; }
}

/** Command-execute tokens live only in this process, never in the manifest cache. */
export class CommandTokenCache {
  private current: { token: string; validUntil: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(private readonly source: CommandTokenSource, private readonly now: () => number = Date.now) {}

  async getToken(): Promise<{ token: string; fromCache: boolean }> {
    if (this.current && this.now() < this.current.validUntil) {
      return { token: this.current.token, fromCache: true };
    }
    if (!this.pending) {
      this.pending = this.source.requestCommandToken().then(({ token, expiresIn }) => {
        if (typeof token !== 'string' || !token.trim() || !Number.isSafeInteger(expiresIn)
          || expiresIn <= 0 || expiresIn > COMMAND_TOKEN_TTL_SECONDS) throw new CommandTokenCacheError();
        const validForMs = Math.max(0, expiresIn - 15) * 1_000;
        this.current = validForMs > 0 ? { token, validUntil: this.now() + validForMs } : null;
        return token;
      }).finally(() => { this.pending = null; });
    }
    return { token: await this.pending, fromCache: false };
  }

  invalidate(token: string): void {
    if (this.current?.token === token) this.current = null;
  }
}
