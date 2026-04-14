/**
 * Configuration for HomePilot UI
 * Injects VITE_API_URL from environment or fallbacks to localhost:3000
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login`,
    logout: `${API_BASE_URL}/api/v1/auth/logout`,
    me: `${API_BASE_URL}/api/v1/auth/me`,
    changePassword: `${API_BASE_URL}/api/v1/auth/change-password`,
  },
  system: {
    setupStatus: `${API_BASE_URL}/api/v1/system/setup-status`,
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
  }
};
