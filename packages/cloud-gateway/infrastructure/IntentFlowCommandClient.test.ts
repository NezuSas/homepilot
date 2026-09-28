import { IntentFlowCommandClient, intentFlowCommandUrl } from './IntentFlowCommandClient';

function response(status: number, payload: unknown = {}): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => payload } as unknown as Response;
}

describe('IntentFlowCommandClient', () => {
  it('uses the configured HTTPS origin and sends only boardId, key and empty body', async () => {
    const http = jest.fn().mockResolvedValue(response(200, { status: 'command_deduplicated' }));
    const client = new IntentFlowCommandClient(() => 'https://intent.example.test:9443', http);
    await client.execute(5, 'go_home', 'secret-command-token');
    expect(http).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledWith(
      'https://intent.example.test:9443/api/homepilot/service/boards/5/commands/go_home/execute/',
      expect.objectContaining({ method: 'POST', body: '{}',
        headers: { Authorization: 'Bearer secret-command-token', 'Content-Type': 'application/json' } }),
    );
  });

  it('rejects a caller-independent invalid base URL', () => {
    for (const base of ['http://intent.example.test', 'https://u:p@intent.example.test',
      'https://intent.example.test/?x=1', 'https://intent.example.test/#x']) {
      expect(() => intentFlowCommandUrl(base, 5, 'go_home')).toThrow('INTENTFLOW_COMMAND_CONFIG_INVALID');
    }
    expect(() => intentFlowCommandUrl('https://intent.example.test', 5, '..'))
      .toThrow('INTENTFLOW_COMMAND_CONFIG_INVALID');
  });

  it.each([
    [400, { code: 'command_device_unavailable' }, 'INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE'],
    [401, {}, 'INTENTFLOW_COMMAND_UNAUTHORIZED'],
    [403, {}, 'INTENTFLOW_COMMAND_FORBIDDEN'],
    [409, { code: 'command_confirmation_required' }, 'INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED'],
    [409, { error: 'homepilot_local_execution_required' }, 'INTENTFLOW_COMMAND_ROUTE_MISMATCH'],
    [502, {}, 'INTENTFLOW_COMMAND_EXECUTION_FAILED'],
  ] as const)('maps HTTP %s to a safe error', async (status, payload, code) => {
    const http = jest.fn().mockResolvedValue(response(status, payload));
    const client = new IntentFlowCommandClient(() => 'https://intent.example.test', http);
    await expect(client.execute(5, 'go_home', 'private-token')).rejects.toMatchObject({ code });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('sanitizes network and response failures without returning token or raw ADB', async () => {
    const client = new IntentFlowCommandClient(() => 'https://intent.example.test',
      jest.fn().mockRejectedValue(new Error('private-token input keyevent 26')));
    const failure = await client.execute(5, 'go_home', 'private-token').catch((error: unknown) => error);
    expect(String(failure)).toBe('IntentFlowCommandError: INTENTFLOW_COMMAND_UNAVAILABLE');
    expect(String(failure)).not.toContain('private-token');
    expect(String(failure)).not.toContain('input keyevent');
  });

  it('times out a hung request without retrying it', async () => {
    jest.useFakeTimers();
    try {
      const http = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('private-token')));
      }));
      const client = new IntentFlowCommandClient(() => 'https://intent.example.test', http);
      const request = client.execute(5, 'go_home', 'private-token');
      jest.advanceTimersByTime(10_000);
      await expect(request).rejects.toMatchObject({ code: 'INTENTFLOW_COMMAND_TIMEOUT' });
      expect(http).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
});
