import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';
import { fetchDiagnosticResource } from '../lib/diagnosticResourceRequests';

/** JSON request helper of the automations view; cancellable catalog reads share the diagnostic cache. */
export async function fetchAutomationJson(url: string, options?: RequestInit) {
  const res = options?.signal && (!options.method || options.method === 'GET')
    && (url === API_ENDPOINTS.automations.list || url === API_ENDPOINTS.scenes.list)
    ? await fetchDiagnosticResource(url, options.signal)
    : await apiFetch(url, options);
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type');
  if (!res.ok) {
    if (contentType && contentType.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.message || `Server error: ${res.status}`);
    }
    throw new Error(`Server returned ${res.status} (${res.statusText})`);
  }
  if (!contentType || !contentType.includes('application/json')) return null;
  return res.json();
}
