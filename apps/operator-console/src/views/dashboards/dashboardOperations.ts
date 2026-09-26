import { API_BASE_URL } from '../../config';
import { apiFetch, getApiRequestScope, readApiError } from '../../lib/apiClient';
import type { Dashboard } from './types';
import type { DashboardRevisionSummary } from '../../components/DashboardHistoryModal';

const API = `${API_BASE_URL}/api/v1`;
const DASHBOARD_CATALOG_FRESHNESS_MS = 15_000;
let catalogGeneration = 0;
let catalogCache: { scope: string; expiresAt: number; data: Dashboard[] } | null = null;
let catalogRequest: { scope: string; promise: Promise<Dashboard[]> } | null = null;

export function invalidateDashboardCatalog(): void {
  catalogGeneration += 1;
  catalogCache = null;
  catalogRequest = null;
}

async function expectDashboard(responsePromise: Promise<Response>, fallback: string): Promise<Dashboard> {
  const response = await responsePromise;
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const dashboard = await response.json() as Dashboard;
  invalidateDashboardCatalog();
  return dashboard;
}

export function loadDashboards(fallback: string): Promise<Dashboard[]> {
  const scope = getApiRequestScope();
  if (catalogCache?.scope === scope && catalogCache.expiresAt > Date.now()) {
    return Promise.resolve(catalogCache.data);
  }
  if (catalogRequest?.scope === scope) return catalogRequest.promise;

  const generation = catalogGeneration;
  const promise = (async () => {
    const response = await apiFetch(`${API}/dashboards`);
    if (!response.ok) throw new Error(await readApiError(response, fallback));
    const payload: unknown = await response.json();
    const data = Array.isArray(payload) ? payload as Dashboard[] : [];
    if (generation === catalogGeneration && getApiRequestScope() === scope) {
      catalogCache = { scope, expiresAt: Date.now() + DASHBOARD_CATALOG_FRESHNESS_MS, data };
    }
    return data;
  })();
  catalogRequest = { scope, promise };
  const release = () => {
    if (catalogRequest?.promise === promise) catalogRequest = null;
  };
  void promise.then(release, release);
  return promise;
}

export function saveDashboard(id: string, body: Partial<Dashboard>, fallback: string): Promise<Dashboard> {
  return expectDashboard(apiFetch(`${API}/dashboards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), fallback);
}

export function createDashboard(title: string, fallback: string): Promise<Dashboard> {
  return expectDashboard(apiFetch(`${API}/dashboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }), fallback);
}

export async function exportDashboard(id: string, fallback: string): Promise<unknown> {
  const response = await apiFetch(`${API}/dashboards/${id}/export`);
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  return response.json();
}

export function importDashboard(transfer: unknown, fallback: string): Promise<Dashboard> {
  return expectDashboard(apiFetch(`${API}/dashboards/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transfer),
  }), fallback);
}

export async function loadDashboardHistory(id: string, fallback: string): Promise<DashboardRevisionSummary[]> {
  const response = await apiFetch(`${API}/dashboards/${id}/history`);
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export function restoreDashboardRevision(dashboardId: string, revisionId: string, fallback: string): Promise<Dashboard> {
  return expectDashboard(apiFetch(`${API}/dashboards/${dashboardId}/history/${revisionId}/restore`, {
    method: 'POST',
  }), fallback);
}

export async function deleteDashboard(id: string, fallback: string): Promise<void> {
  const response = await apiFetch(`${API}/dashboards/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  invalidateDashboardCatalog();
}
