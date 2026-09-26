import { apiFetch, getApiRequestScope } from '../../lib/apiClient';
import { invalidateDashboardCatalog, loadDashboards, saveDashboard } from './dashboardOperations';

jest.mock('../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../../lib/apiClient', () => ({
  apiFetch: jest.fn(),
  getApiRequestScope: jest.fn(() => 'session-a'),
  readApiError: jest.fn(async () => 'No se pudo cargar'),
}));

const mockFetch = apiFetch as jest.Mock;
const mockScope = getApiRequestScope as jest.Mock;
const listResponse = (id: string) => new Response(JSON.stringify([{ id }]), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  invalidateDashboardCatalog();
  mockFetch.mockReset();
  mockScope.mockReturnValue('session-a');
});

afterEach(() => {
  jest.useRealTimers();
});

it('shares a pending dashboard read between sidebar and view, then reuses it only while fresh', async () => {
  mockFetch.mockResolvedValueOnce(listResponse('first')).mockResolvedValueOnce(listResponse('second'));

  const sidebar = loadDashboards('Error de sidebar');
  const view = loadDashboards('Error de vista');
  expect(sidebar).toBe(view);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await expect(sidebar).resolves.toEqual([{ id: 'first' }]);
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'first' }]);
  expect(mockFetch).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(15_001);
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'second' }]);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('never reuses another session catalog and invalidates after a successful edit', async () => {
  mockFetch
    .mockResolvedValueOnce(listResponse('session-a-dashboard'))
    .mockResolvedValueOnce(listResponse('session-b-dashboard'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'edited' }), { status: 200 }))
    .mockResolvedValueOnce(listResponse('edited'));

  await loadDashboards('Error');
  mockScope.mockReturnValue('session-b');
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'session-b-dashboard' }]);
  await saveDashboard('edited', { title: 'Nuevo nombre' }, 'Error');
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'edited' }]);
  expect(mockFetch).toHaveBeenCalledTimes(4);
});

it('does not repopulate the cache with a response invalidated while pending', async () => {
  let completeOld: ((response: Response) => void) | undefined;
  mockFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { completeOld = resolve; }));
  mockFetch.mockResolvedValueOnce(listResponse('new'));

  const old = loadDashboards('Error');
  invalidateDashboardCatalog();
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'new' }]);
  completeOld?.(listResponse('old'));
  await expect(old).resolves.toEqual([{ id: 'old' }]);
  await expect(loadDashboards('Error')).resolves.toEqual([{ id: 'new' }]);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
