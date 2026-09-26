import { apiFetch, getApiRequestScope } from '../apiClient';
import { fetchDiagnosticResource, startSequentialPolling } from '../diagnosticResourceRequests';

jest.mock('../apiClient', () => ({ apiFetch: jest.fn(), getApiRequestScope: jest.fn(() => 'session-es') }));

const mockFetch = apiFetch as jest.Mock;
const mockScope = getApiRequestScope as jest.Mock;
const URL = '/api/v1/system/diagnostics';

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
  mockScope.mockReturnValue('session-es');
});

afterEach(() => {
  jest.useRealTimers();
});

it('keeps at most one HTTP request active through two minutes of slow polling', async () => {
  let active = 0;
  let peak = 0;
  mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    active++;
    peak = Math.max(peak, active);
    const timer = setTimeout(() => {
      active--;
      resolve(new Response('{}'));
    }, 8_000);
    init.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      active--;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  }));

  const stop = startSequentialPolling(async (signal) => {
    const response = await fetchDiagnosticResource(URL, signal);
    await response.json();
  }, 5_000);
  await jest.advanceTimersByTimeAsync(120_000);
  expect(peak).toBe(1);
  expect(active).toBeLessThanOrEqual(1);
  expect(mockFetch.mock.calls.length).toBeGreaterThan(8);
  stop();
  await jest.advanceTimersByTimeAsync(1);
  expect(active).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('deduplicates identical consumers and cancels only after the last one leaves', async () => {
  let aborted = false;
  mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      aborted = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  }));
  const first = new AbortController();
  const second = new AbortController();
  const one = fetchDiagnosticResource(URL, first.signal);
  const two = fetchDiagnosticResource(URL, second.signal);
  expect(mockFetch).toHaveBeenCalledTimes(1);

  first.abort();
  await expect(one).rejects.toMatchObject({ name: 'AbortError' });
  expect(aborted).toBe(false);
  second.abort();
  await expect(two).rejects.toMatchObject({ name: 'AbortError' });
  expect(aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it('times out a stalled response and recovers on the next poll', async () => {
  let calls = 0;
  mockFetch.mockImplementation((_url: string, init: RequestInit) => {
    calls++;
    if (calls > 1) return Promise.resolve(new Response('{}'));
    // A transport that ignores abort must still release the waiting UI.
    void init;
    return new Promise<Response>(() => undefined);
  });
  const failures: string[] = [];
  const stop = startSequentialPolling(async (signal) => {
    try {
      await fetchDiagnosticResource(URL, signal);
    } catch (error) {
      failures.push((error as Error).message);
    }
  }, 5_000);
  await jest.advanceTimersByTimeAsync(10_000);
  expect(failures).toEqual(['REQUEST_TIMEOUT']);
  await jest.advanceTimersByTimeAsync(5_000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  stop();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not multiply timers after repeated view mounts and unmounts', async () => {
  mockFetch.mockResolvedValue(new Response('{}'));
  for (let index = 0; index < 10; index++) {
    const stop = startSequentialPolling((signal) => fetchDiagnosticResource(URL, signal).then(() => undefined), 5_000);
    await jest.advanceTimersByTimeAsync(0);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  }
});

it('never delivers a response across a session change', async () => {
  let complete: ((response: Response) => void) | undefined;
  mockFetch.mockImplementation(() => new Promise<Response>((resolve) => { complete = resolve; }));
  const controller = new AbortController();
  const pending = fetchDiagnosticResource(URL, controller.signal);
  mockScope.mockReturnValue('different-session');
  complete?.(new Response('{"private":true}'));
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  expect(jest.getTimerCount()).toBe(0);
});
