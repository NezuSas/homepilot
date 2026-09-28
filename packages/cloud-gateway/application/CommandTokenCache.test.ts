import { CommandTokenCache } from './CommandTokenCache';

describe('CommandTokenCache', () => {
  it('keeps only a command token in memory and expires it at least 15 seconds early', async () => {
    let now = 1_000;
    const source = { requestCommandToken: jest.fn()
      .mockResolvedValueOnce({ token: 'first-command-token', expiresIn: 120 })
      .mockResolvedValueOnce({ token: 'second-command-token', expiresIn: 120 }) };
    const cache = new CommandTokenCache(source, () => now);
    expect(await cache.getToken()).toEqual({ token: 'first-command-token', fromCache: false });
    now += 104_999;
    expect(await cache.getToken()).toEqual({ token: 'first-command-token', fromCache: true });
    now += 1;
    expect(await cache.getToken()).toEqual({ token: 'second-command-token', fromCache: false });
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it('uses Directory expiresIn rather than assuming the full 120 seconds', async () => {
    let now = 0;
    const source = { requestCommandToken: jest.fn()
      .mockResolvedValue({ token: 'short-lived', expiresIn: 30 }) };
    const cache = new CommandTokenCache(source, () => now);
    await cache.getToken();
    now = 15_000;
    await cache.getToken();
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it('invalidates only the token that was rejected', async () => {
    const source = { requestCommandToken: jest.fn().mockResolvedValue({ token: 'command-only', expiresIn: 120 }) };
    const cache = new CommandTokenCache(source, () => 0);
    await cache.getToken();
    cache.invalidate('another-token');
    expect((await cache.getToken()).fromCache).toBe(true);
    cache.invalidate('command-only');
    expect((await cache.getToken()).fromCache).toBe(false);
  });

  it('does not share its command token with another cache instance', async () => {
    const source = { requestCommandToken: jest.fn().mockResolvedValue({ token: 'ephemeral', expiresIn: 120 }) };
    await new CommandTokenCache(source, () => 0).getToken();
    await new CommandTokenCache(source, () => 0).getToken();
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it('coalesces simultaneous command-token exchanges', async () => {
    let complete!: (value: { token: string; expiresIn: number }) => void;
    const source = { requestCommandToken: jest.fn().mockImplementation(() =>
      new Promise<{ token: string; expiresIn: number }>((resolve) => { complete = resolve; })) };
    const cache = new CommandTokenCache(source, () => 0);
    const first = cache.getToken();
    const second = cache.getToken();
    complete({ token: 'one-exchange', expiresIn: 120 });
    expect(await Promise.all([first, second])).toEqual([
      { token: 'one-exchange', fromCache: false }, { token: 'one-exchange', fromCache: false },
    ]);
    expect(source.requestCommandToken).toHaveBeenCalledTimes(1);
  });
});
