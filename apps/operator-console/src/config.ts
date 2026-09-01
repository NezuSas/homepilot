/**
 * Configuration for HomePilot UI
 * Uses an explicit VITE_API_URL when configured. Production defaults to the
 * current origin so Nginx can proxy API and WebSocket traffic internally.
 */
declare global {
  interface Window {
    /** Set by the Cloud host before the shared console bundle loads. */
    __HOMEPILOT_API_BASE_URL__?: string;
  }
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const cloudHomeMatch = typeof window === 'undefined' ? null : window.location.pathname.match(/^\/homes\/([^/]+)\/console(?:\/|$)/);
const cloudApiUrl = typeof window === 'undefined' ? undefined : window.__HOMEPILOT_API_BASE_URL__?.trim() || (cloudHomeMatch ? '/homes/' + encodeURIComponent(cloudHomeMatch[1]) : undefined);

/**
 * The Operator Console is intentionally a single application. Its local build
 * talks to the Edge on the current origin; HomePilot Cloud supplies a scoped
 * gateway prefix at runtime, without forking the UI or exposing an Edge host.
 */
export const API_BASE_URL = cloudApiUrl || configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login`,
    logout: `${API_BASE_URL}/api/v1/auth/logout`,
    me: `${API_BASE_URL}/api/v1/auth/me`,
    changePassword: `${API_BASE_URL}/api/v1/auth/change-password`,
  },
  system: {
    setupStatus: `${API_BASE_URL}/api/v1/system/setup-status`,
    bootstrapAdmin: `${API_BASE_URL}/api/v1/system/bootstrap-admin`,
    diagnostics: `${API_BASE_URL}/api/v1/system/diagnostics`,
    events: `${API_BASE_URL}/api/v1/system/diagnostics/events`,
  },
  admin: {
    users: `${API_BASE_URL}/api/v1/admin/users`,
  },
  topology: {
    homes: `${API_BASE_URL}/api/v1/homes`,
    rooms: `${API_BASE_URL}/api/v1/rooms`,
  },
  devices: {
    list: `${API_BASE_URL}/api/v1/devices`,
  },
  scenes: {
    list: `${API_BASE_URL}/api/v1/scenes`,
  },
  automations: {
    list: `${API_BASE_URL}/api/v1/automations`,
  },
  assistant: {
    findings: `${API_BASE_URL}/api/v1/assistant/findings`,
    summary: `${API_BASE_URL}/api/v1/assistant/summary`,
    scan: `${API_BASE_URL}/api/v1/assistant/scan`,
    dismiss: (id: string) => `${API_BASE_URL}/api/v1/assistant/findings/${id}/dismiss`,
    resolve: (id: string) => `${API_BASE_URL}/api/v1/assistant/findings/${id}/resolve`,
    executeAction: `${API_BASE_URL}/api/v1/assistant/actions`,
  }
};
