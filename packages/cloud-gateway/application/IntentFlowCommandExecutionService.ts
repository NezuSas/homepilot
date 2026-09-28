export interface CommandExecutionPorts {
  readonly tokens: {
    getToken(): Promise<{ token: string; fromCache: boolean }>;
    invalidate(token: string): void;
  };
  readonly client: { execute(boardId: number, commandKey: string, token: string): Promise<void> };
}

/** A stale cached credential gets one fresh exchange; functional failures never retry. */
export class IntentFlowCommandExecutionService {
  constructor(private readonly ports: CommandExecutionPorts) {}

  async execute(boardId: number, commandKey: string): Promise<void> {
    const first = await this.ports.tokens.getToken();
    try {
      await this.ports.client.execute(boardId, commandKey, first.token);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error)
        || error.code !== 'INTENTFLOW_COMMAND_UNAUTHORIZED') throw error;
      this.ports.tokens.invalidate(first.token);
      if (!first.fromCache) throw error;
      const fresh = await this.ports.tokens.getToken();
      try {
        await this.ports.client.execute(boardId, commandKey, fresh.token);
      } catch (retryError) {
        if (retryError && typeof retryError === 'object' && 'code' in retryError
          && retryError.code === 'INTENTFLOW_COMMAND_UNAUTHORIZED') this.ports.tokens.invalidate(fresh.token);
        throw retryError;
      }
    }
  }
}
