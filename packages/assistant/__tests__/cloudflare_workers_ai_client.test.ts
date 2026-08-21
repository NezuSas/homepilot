import { CloudflareWorkersAiClient } from '../infrastructure/CloudflareWorkersAiClient';

describe('CloudflareWorkersAiClient', () => {
  const client = new CloudflareWorkersAiClient('account-id', 'secret-token', '@cf/meta/llama-3.1-8b-instruct-fast', 100);

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sends a bounded structured request without exposing the API token in the body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, result: { response: { text: 'Respuesta breve' } } })
    });

    await expect(client.generateJson('prompt', {
      timeoutMs: 2200,
      numPredict: 28,
      format: { type: 'object', properties: { text: { type: 'string' } } }
    })).resolves.toEqual({ text: 'Respuesta breve' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/accounts/account-id/ai/run/@cf/meta/llama-3.1-8b-instruct-fast');
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body)).toEqual(expect.objectContaining({
      max_tokens: 28,
      response_format: expect.objectContaining({ type: 'json_schema' })
    }));
    expect(init.body).not.toContain('secret-token');
  });

  it('parses a JSON string returned by the compatible REST endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, result: { response: '{"text":"Hola"}' } })
    });

    await expect(client.generateJson('prompt')).resolves.toEqual({ text: 'Hola' });
  });

  it('fails closed when Cloudflare reports an unsuccessful request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: false, errors: [{ message: 'quota exceeded' }] })
    });

    await expect(client.generateJson('prompt')).rejects.toThrow('Cloudflare Workers AI request failed: quota exceeded');
  });
});
