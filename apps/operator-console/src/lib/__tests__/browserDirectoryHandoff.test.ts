import { consumeBrowserDirectoryHandoff } from '../browserDirectoryHandoff';

const endpoint = '/api/v1/auth/sso/directory/consume-browser';

beforeEach(() => {
  globalThis.fetch = jest.fn();
});

it('treats normal 204 startup as no handoff without parsing a body', async () => {
  const json = jest.fn();
  (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 204, ok: true, json });
  await expect(consumeBrowserDirectoryHandoff(endpoint)).resolves.toBeNull();
  expect(globalThis.fetch).toHaveBeenCalledWith(endpoint, { method: 'POST' });
  expect(json).not.toHaveBeenCalled();
});

it('preserves a valid linked handoff', async () => {
  const handoff = { linked: true, token: 'session', user: { id: 'owner' } };
  (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true, json: async () => handoff });
  await expect(consumeBrowserDirectoryHandoff(endpoint)).resolves.toEqual(handoff);
});

it('does not hide a present but invalid handoff or a missing route', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ status: 401, ok: false });
  await expect(consumeBrowserDirectoryHandoff(endpoint)).rejects.toThrow('DIRECTORY_SSO_401');
  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ status: 404, ok: false });
  await expect(consumeBrowserDirectoryHandoff(endpoint)).rejects.toThrow('DIRECTORY_SSO_404');
});
