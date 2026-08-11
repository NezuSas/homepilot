import type { View } from '../types';

export const DASHBOARDS_TAB_PATTERN = '/dashboards/:dashboardId/:tabId';
export const DASHBOARDS_ONE_PATTERN = '/dashboards/:dashboardId';

export function resolveView(view: View): View {
  switch (view) {
    case 'scenes': return 'routines'; case 'automations': return 'routines'; case 'topology': return 'spaces';
    case 'inbox': return 'system-inbox'; case 'audit-logs': return 'system-audit'; case 'ha-settings': return 'system-ha';
    case 'diagnostics': return 'system-diagnostics'; case 'users': return 'system-users'; default: return view;
  }
}

export function isSystemView(view: View): boolean {
  return ['system-devices', 'system-inbox', 'system-diagnostics', 'system-audit', 'system-executions', 'system-users', 'system-ha', 'system-cameras', 'system-onboarding'].includes(view);
}

export function viewToPath(view: View): string {
  const paths: Partial<Record<View, string>> = {
    dashboard: '/', spaces: '/spaces', routines: '/routines/scenes', scenes: '/routines/scenes', automations: '/routines/automations', assistant: '/assistant', energy: '/energy', 'resilience-showcase': '/resilience-showcase', 'home-conversation': '/home-conversation', dashboards: '/dashboards', 'system-devices': '/system/devices', 'system-inbox': '/system/inbox', 'system-diagnostics': '/system/diagnostics', 'system-audit': '/system/audit', 'system-executions': '/system/executions', 'system-users': '/system/users', 'system-ha': '/system/ha', 'system-cameras': '/system/cameras', 'system-onboarding': '/system/onboarding'
  };
  return paths[view] ?? '/';
}

export function pathToView(pathname: string): View {
  if (pathname.startsWith('/dashboards')) return 'dashboards';
  const paths: Record<string, View> = {
    '/spaces': 'spaces', '/routines': 'routines', '/routines/scenes': 'routines', '/routines/automations': 'routines', '/scenes': 'routines', '/automations': 'routines', '/assistant': 'assistant', '/energy': 'energy', '/resilience-showcase': 'resilience-showcase', '/home-conversation': 'home-conversation', '/system/devices': 'system-devices', '/system/inbox': 'system-inbox', '/system/diagnostics': 'system-diagnostics', '/system/audit': 'system-audit', '/system/executions': 'system-executions', '/system/users': 'system-users', '/system/ha': 'system-ha', '/system/cameras': 'system-cameras', '/system/onboarding': 'system-onboarding'
  };
  return paths[pathname] ?? 'dashboard';
}