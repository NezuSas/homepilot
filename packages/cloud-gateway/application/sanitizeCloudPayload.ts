type RecordValue = Record<string, unknown>;

export function sanitizeDashboardPayload(value: unknown): { dashboards: Array<{ id: string; title: string; tabs: Array<{ id: string; title: string }> }> } {
  const dashboards = Array.isArray(value) ? value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') return [];
    const tabs = Array.isArray(item.tabs) ? item.tabs.flatMap((tab) => isRecord(tab) && typeof tab.id === 'string' && typeof tab.title === 'string' ? [{ id: tab.id, title: tab.title }] : []) : [];
    return [{ id: item.id, title: item.title, tabs }];
  }) : [];
  return { dashboards };
}

export function sanitizeDevicePayload(value: unknown): { devices: Array<{ id: string; name: string; type: string; state: unknown; roomId: string | null; isOnline: boolean }> } {
  const devices = Array.isArray(value) ? value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.type !== 'string') return [];
    const state = isRecord(item.lastKnownState) ? item.lastKnownState : item.state ?? null;
    const reportedState = isRecord(state) && typeof state.state === 'string' ? state.state.toLowerCase() : null;
    const isOnline = item.isOnline === true || (item.isOnline !== false && reportedState !== 'unavailable' && reportedState !== 'unknown');
    return [{ id: item.id, name: item.name, type: item.type, state, roomId: typeof item.roomId === 'string' ? item.roomId : null, isOnline }];
  }) : [];
  return { devices };
}
function isRecord(value: unknown): value is RecordValue { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
