import { act } from 'react-test-renderer';
import { useSession, type UserContext } from '../useSession';
import { useHomeIdleReturn } from '../useHomeIdleReturn';
import { useUserFavorites } from '../useUserFavorites';
import { apiFetch } from '../apiClient';
import { flushPromises, installFakeWindow, jsonResponse, makeLocalStorage, renderHook } from './renderHook';

const setSessionToken = jest.fn();

jest.mock('../../config', () => ({
  API_BASE_URL: '',
  API_ENDPOINTS: { auth: { me: '/api/v1/auth/me' } },
}));
jest.mock('../apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../stores/useAppShellStore', () => ({
  useAppShellStore: (selector: (state: { setSessionToken: jest.Mock }) => unknown) => selector({ setSessionToken }),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const admin: UserContext = { id: 'u1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };

describe('Feature: useSession', () => {
  let env: ReturnType<typeof installFakeWindow>;
  beforeEach(() => { env = installFakeWindow(); });
  afterEach(() => env.restore());

  it('Scenario: Given no stored token When the hook starts Then the visitor is unauthenticated', () => {
    makeLocalStorage();
    const { result } = renderHook(() => useSession(jest.fn()), undefined);
    expect(result.current).toMatchObject({ status: 'unauthenticated', user: null, isAuthenticated: false });
  });

  it('Scenario: Given a stored token When the session is validated Then the user and token are published', async () => {
    const { data } = makeLocalStorage({ hp_session_token: 'tok' });
    apiFetchMock.mockResolvedValue(jsonResponse(admin));
    const { result } = renderHook(() => useSession(jest.fn()), undefined);
    expect(result.current.status).toBe('checking');

    await act(async () => { await result.current.validateSession(); });

    expect(result.current).toMatchObject({ status: 'authenticated', user: admin, isAuthenticated: true });
    expect(setSessionToken).toHaveBeenCalledWith('tok');
    expect(JSON.parse(data.get('hp_user_ctx')!)).toEqual(admin);
  });

  it.each([
    ['a server error', () => apiFetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }))],
    ['a network failure', () => apiFetchMock.mockRejectedValue(new Error('offline'))],
  ])('Scenario: Given %s When the session is validated Then it fails closed', async (_name, arrange) => {
    const { data } = makeLocalStorage({ hp_session_token: 'tok' });
    arrange();
    const cleared = jest.fn();
    const { result } = renderHook(() => useSession(cleared), undefined);

    await act(async () => { await result.current.validateSession(); });

    expect(result.current.status).toBe('unauthenticated');
    expect(data.has('hp_session_token')).toBe(false);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given a 401 When the session is validated Then the client interceptor owns the cleanup', async () => {
    makeLocalStorage({ hp_session_token: 'tok' });
    apiFetchMock.mockResolvedValue(jsonResponse({}, { status: 401 }));
    const cleared = jest.fn();
    const { result } = renderHook(() => useSession(cleared), undefined);

    await act(async () => { await result.current.validateSession(); });

    expect(cleared).not.toHaveBeenCalled();
  });

  it('Scenario: Given a login When it succeeds Then the token and context are stored', () => {
    const { data } = makeLocalStorage();
    const { result } = renderHook(() => useSession(jest.fn()), undefined);

    act(() => result.current.handleLoginSuccess('fresh', admin));

    expect(result.current).toMatchObject({ status: 'authenticated', user: admin });
    expect(data.get('hp_session_token')).toBe('fresh');
  });

  it('Scenario: Given a failing logout call When the user logs out Then the local session is still cleared', async () => {
    const { data } = makeLocalStorage({ hp_session_token: 'tok', hp_user_ctx: JSON.stringify(admin) });
    const { result } = renderHook(() => useSession(jest.fn()), undefined);

    await act(async () => { await result.current.handleLogout(() => Promise.reject(new Error('api down'))); });

    expect(result.current).toMatchObject({ status: 'unauthenticated', user: null });
    expect(data.size).toBe(0);
    expect(setSessionToken).toHaveBeenLastCalledWith(null);
  });

  it('Scenario: Given the global unauthorized event When it fires Then the session is cleared and the listener is removed on unmount', () => {
    makeLocalStorage({ hp_session_token: 'tok' });
    const cleared = jest.fn();
    const { result, unmount } = renderHook(() => useSession(cleared), undefined);

    act(() => { env.window.dispatchEvent(new Event('hp-session-unauthorized')); });
    expect(result.current.status).toBe('unauthenticated');
    expect(cleared).toHaveBeenCalledTimes(1);

    unmount();
    env.window.dispatchEvent(new Event('hp-session-unauthorized'));
    expect(cleared).toHaveBeenCalledTimes(1);
  });
});

describe('Feature: useHomeIdleReturn', () => {
  let env: ReturnType<typeof installFakeWindow>;
  beforeEach(() => { jest.useFakeTimers(); env = installFakeWindow(); });
  afterEach(() => { env.restore(); jest.useRealTimers(); });

  it('Scenario: Given an enabled hook When the idle period passes Then the callback runs once', () => {
    const onIdle = jest.fn();
    renderHook(() => useHomeIdleReturn(true, onIdle, 1000), undefined);
    jest.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given user activity When it happens before the deadline Then the period restarts', () => {
    const onIdle = jest.fn();
    renderHook(() => useHomeIdleReturn(true, onIdle, 1000), undefined);
    jest.advanceTimersByTime(800);
    env.window.dispatchEvent(new Event('keydown'));
    jest.advanceTimersByTime(800);
    expect(onIdle).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given an untrusted scroll When it fires Then it does not count as activity', () => {
    const onIdle = jest.fn();
    renderHook(() => useHomeIdleReturn(true, onIdle, 1000), undefined);
    jest.advanceTimersByTime(800);
    env.window.dispatchEvent(new Event('scroll'));
    jest.advanceTimersByTime(200);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given an open modal dialog When the deadline arrives Then the return is postponed', () => {
    const onIdle = jest.fn();
    env.document.querySelector.mockReturnValue({});
    renderHook(() => useHomeIdleReturn(true, onIdle, 1000), undefined);
    jest.advanceTimersByTime(3000);
    expect(onIdle).not.toHaveBeenCalled();
    env.document.querySelector.mockReturnValue(null);
    jest.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given a disabled or unmounted hook When time passes Then the callback never runs', () => {
    const onIdle = jest.fn();
    renderHook(() => useHomeIdleReturn(false, onIdle, 1000), undefined);
    const mounted = renderHook(() => useHomeIdleReturn(true, onIdle, 1000), undefined);
    mounted.unmount();
    jest.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});

describe('Feature: useUserFavorites', () => {
  let env: ReturnType<typeof installFakeWindow>;
  beforeEach(() => { env = installFakeWindow(); });
  afterEach(() => env.restore());

  const favoritesUrl = '/api/v1/scenes/favorites';

  it('Scenario: Given no user When the hook renders Then it is settled without requests', async () => {
    makeLocalStorage();
    const { result } = renderHook(({ id }: { id: string | null }) => useUserFavorites(id, ['s1'], 'scene'), { id: null });
    await flushPromises();
    expect(result.current).toMatchObject({ favorites: [], settled: true, loaded: false });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('Scenario: Given backend favorites When the user loads Then they are authoritative', async () => {
    makeLocalStorage();
    apiFetchMock.mockResolvedValue(jsonResponse({ sceneIds: ['s2'] }));
    const { result } = renderHook(() => useUserFavorites('u1', ['s1', 's2'], 'scene'), undefined);
    await flushPromises();
    expect(result.current).toMatchObject({ favorites: ['s2'], loaded: true, settled: true });
    expect(apiFetchMock).toHaveBeenCalledWith(favoritesUrl);
  });

  it('Scenario: Given legacy browser favorites When they are accessible Then they migrate once and the local copy is removed', async () => {
    const { data } = makeLocalStorage();
    const { SCENE_FAVORITES_STORAGE_KEY } = await import('../favorites');
    data.set(SCENE_FAVORITES_STORAGE_KEY, JSON.stringify(['s1', 'hidden']));
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ sceneIds: ['s2'] }))
      .mockResolvedValueOnce(jsonResponse(['s2', 's1']));

    const { result } = renderHook(() => useUserFavorites('u1', ['s1', 's2'], 'scene'), undefined);
    await flushPromises();

    expect(apiFetchMock).toHaveBeenLastCalledWith(favoritesUrl, expect.objectContaining({ method: 'PUT', body: JSON.stringify({ sceneIds: ['s2', 's1'] }) }));
    expect(result.current.favorites).toEqual(['s2', 's1']);
    expect(data.has(SCENE_FAVORITES_STORAGE_KEY)).toBe(false);
  });

  it('Scenario: Given a loaded list When a favorite is toggled Then it saves, and a failed save rolls back', async () => {
    makeLocalStorage();
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ sceneIds: ['s1'] }));
    const { result } = renderHook(() => useUserFavorites('u1', ['s1', 's2'], 'scene'), undefined);
    await flushPromises();

    apiFetchMock.mockResolvedValueOnce(jsonResponse(['s1', 's2']));
    await act(async () => { await result.current.toggleFavorite('s2'); });
    expect(result.current.favorites).toEqual(['s1', 's2']);

    apiFetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
    await act(async () => { await result.current.toggleFavorite('s1'); });
    expect(result.current.favorites).toEqual(['s1', 's2']);
  });

  it('Scenario: Given a failing backend When favorites load Then the hook settles empty and unloaded', async () => {
    makeLocalStorage();
    apiFetchMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useUserFavorites('u1', ['s1'], 'scene'), undefined);
    await flushPromises();
    expect(result.current).toMatchObject({ favorites: [], loaded: false, settled: true });
  });

  it('Scenario: Given a different user When the identity changes Then the previous favorites disappear immediately', async () => {
    makeLocalStorage();
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ sceneIds: ['s1'] }));
    const { result, rerender } = renderHook(({ id }: { id: string }) => useUserFavorites(id, ['s1'], 'scene'), { id: 'u1' });
    await flushPromises();
    expect(result.current.favorites).toEqual(['s1']);

    apiFetchMock.mockResolvedValueOnce(jsonResponse({ sceneIds: [] }));
    rerender({ id: 'u2' });
    expect(result.current.favorites).toEqual([]);
    await flushPromises();
    expect(result.current.favorites).toEqual([]);
  });
});
