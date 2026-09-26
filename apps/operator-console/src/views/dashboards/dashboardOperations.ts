import { API_BASE_URL } from '../../config';
import { apiFetch, readApiError } from '../../lib/apiClient';
import type { Dashboard } from './types';
import type { DashboardRevisionSummary } from '../../components/DashboardHistoryModal';

const API = `${API_BASE_URL}/api/v1`;

async function expectDashboard(responsePromise: Promise<Response>, fallback: string): Promise<Dashboard> {
  const response = await responsePromise;
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  return response.json() as Promise<Dashboard>;
}

export async function loadDashboards(fallback: string): Promise<Dashboard[]> {
  const response = await apiFetch(`${API}/dashboards`);
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
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
}
