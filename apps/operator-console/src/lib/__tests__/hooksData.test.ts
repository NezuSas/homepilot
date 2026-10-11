import { useInstalledFeatures } from '../useInstalledFeatures';
import { useSetupStatus } from '../useSetupStatus';
import { useDatabaseBackups } from '../useDatabaseBackups';
import { apiFetch } from '../apiClient';
import { flushPromises, jsonResponse, renderHook } from './renderHook';

jest.mock('../../config', () => ({
  API_BASE_URL: '',
  API_ENDPOINTS: { system: { setupStatus: '/api/v1/system/setup-status', features: '/api/v1/system/features' } },
}));
jest.mock('../apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../components/DatabaseBackupsCard', () => ({}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const fetchMock = jest.fn();
(globalThis as Record<string, unknown>).fetch = fetchMock;

describe('Feature: useInstalledFeatures', () => {
  it('Scenario: Given no session When the hook renders Then every option stays on and nothing is requested', async () => {
    const { result } = renderHook(useInstalledFeatures, false);
    await flushPromises();
    expect(result.current).toEqual({ homeChat: true });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('Scenario: Given a session When the installation disables the chat Then the option turns off', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ homeChat: false }));
    const { result } = renderHook(useInstalledFeatures, true);
    await flushPromises();
    expect(result.current).toEqual({ homeChat: false });
  });

  it.each([
    ['a failed read', () => apiFetchMock.mockRejectedValue(new Error('offline'))],
    ['a non-OK answer', () => apiFetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }))],
    ['an unexpected body', () => apiFetchMock.mockResolvedValue(jsonResponse({ homeChat: 'no' }))],
  ])('Scenario: Given %s When the hook renders Then the chat stays available', async (_name, arrange) => {
    arrange();
    const { result } = renderHook(useInstalledFeatures, true);
    await flushPromises();
    expect(result.current).toEqual({ homeChat: true });
  });

  it('Scenario: Given a late answer When the hook unmounts first Then nothing is applied', async () => {
    let resolve!: (value: Response) => void;
    apiFetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    const { result, unmount } = renderHook(useInstalledFeatures, true);
    unmount();
    resolve(jsonResponse({ homeChat: false }));
    await flushPromises();
    expect(result.current).toEqual({ homeChat: true });
  });
});

describe('Feature: useSetupStatus', () => {
  const status = { isInitialized: true, requiresOnboarding: true };

  it('Scenario: Given a signed-out visitor When the status loads Then the factory state is exposed', async () => {
    fetchMock.mockResolvedValue(jsonResponse(status));
    const { result } = renderHook(useSetupStatus, 'unauthenticated' as const);
    expect(result.current.loadingSetup).toBe(true);
    await flushPromises();
    expect(result.current).toMatchObject({ setupStatus: status, loadingSetup: false, isBackendOffline: false });
  });

  it('Scenario: Given a protected installation When the visitor is signed out Then no status and no offline banner appear', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 401 }));
    const { result } = renderHook(useSetupStatus, 'unauthenticated' as const);
    await flushPromises();
    expect(result.current).toMatchObject({ setupStatus: null, loadingSetup: false, isBackendOffline: false });
  });

  it('Scenario: Given an HTML answer or a network failure When the status loads Then the backend is reported offline', async () => {
    fetchMock.mockResolvedValue(jsonResponse('<html/>', { contentType: 'text/html' }));
    const html = renderHook(useSetupStatus, 'unauthenticated' as const);
    await flushPromises();
    expect(html.result.current.isBackendOffline).toBe(true);

    fetchMock.mockRejectedValue(new Error('down'));
    const down = renderHook(useSetupStatus, 'unauthenticated' as const);
    await flushPromises();
    expect(down.result.current.isBackendOffline).toBe(true);
  });

  it('Scenario: Given an authenticated session When onboarding finishes Then the flag is cleared locally', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(status));
    const { result } = renderHook(useSetupStatus, 'authenticated' as const);
    await flushPromises();
    expect(result.current.setupStatus).toEqual(status);

    const { act } = await import('react-test-renderer');
    act(() => result.current.markOnboardingCompleted());
    expect(result.current.setupStatus).toEqual({ isInitialized: true, requiresOnboarding: false });
  });

  it('Scenario: Given a session still being checked When the hook renders Then it requests nothing', async () => {
    const { result } = renderHook(useSetupStatus, 'checking' as const);
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.setupStatus).toBeNull();
  });
});

describe('Feature: useDatabaseBackups', () => {
  const backup = (filename: string) => ({ filename, sizeBytes: 1, createdAt: '2026-10-11T00:00:00.000Z' });

  it('Scenario: Given a non-administrator When the hook renders Then the list is never requested', async () => {
    const { result } = renderHook(useDatabaseBackups, false);
    await flushPromises();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.settled).toBe(false);
  });

  it('Scenario: Given an administrator When the hook renders Then the backups load and the state settles', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse([backup('a.db')]));
    const { result } = renderHook(useDatabaseBackups, true);
    await flushPromises();
    expect(result.current).toMatchObject({ backups: [backup('a.db')], loading: false, hasError: false, settled: true });
  });

  it('Scenario: Given a failing list When the hook loads Then the error is flagged without dropping the state', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));
    const { result } = renderHook(useDatabaseBackups, true);
    await flushPromises();
    expect(result.current).toMatchObject({ backups: [], hasError: true, settled: true, loading: false });
  });

  it('Scenario: Given a created backup When it repeats an existing name Then it replaces it at the top of the list', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse([backup('a.db'), backup('b.db')]));
    const { result } = renderHook(useDatabaseBackups, true);
    await flushPromises();

    apiFetchMock.mockResolvedValueOnce(jsonResponse(backup('b.db')));
    const { act } = await import('react-test-renderer');
    await act(async () => { await result.current.create(); });

    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/v1/system/backups', { method: 'POST' });
    expect(result.current.backups.map((item) => item.filename)).toEqual(['b.db', 'a.db']);
    expect(result.current.creating).toBe(false);
  });

  it('Scenario: Given a rejected creation When the administrator creates a backup Then the error is flagged', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { result } = renderHook(useDatabaseBackups, true);
    await flushPromises();

    apiFetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
    const { act } = await import('react-test-renderer');
    await act(async () => { await result.current.create(); });
    expect(result.current.hasError).toBe(true);
    expect(result.current.creating).toBe(false);
  });
});
