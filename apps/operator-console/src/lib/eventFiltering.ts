export function localEventDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Resolve names only from explicit metadata or a known device; IDs are never search text. */
export function eventNames(raw: unknown, devices: readonly { id: string; name: string }[]): string[] {
  if (typeof raw === 'string') { try { return eventNames(JSON.parse(raw), devices); } catch { return []; } }
  if (Array.isArray(raw)) return raw.flatMap(value => eventNames(value, devices));
  if (!raw || typeof raw !== 'object') return [];
  const names: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (['name', 'deviceName', 'sceneName', 'ruleName', 'automationName'].includes(key) && typeof value === 'string') names.push(value);
    else if (['deviceId', 'targetDeviceId', 'entityId'].includes(key) && typeof value === 'string') {
      const device = devices.find(device => device.id === value);
      if (device) names.push(device.name);
    } else if (value && typeof value === 'object') names.push(...eventNames(value, devices));
  }
  return names;
}

export function matchesEventName(query: string, names: readonly string[]): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  return !normalized || names.some(name => name.toLocaleLowerCase().includes(normalized));
}

export function eventAction(type: string, raw: unknown): string {
  let data: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* A malformed payload cannot provide action evidence. */ }
  if (data.ruleId || data.automationId || data.isAutomation === true || data.sourceType === 'automation' || type.startsWith('AUTOMATION')) return 'automation';
  if (data.sceneId || data.sceneName || type.startsWith('SCENE')) return 'scene';
  return type.includes('COMMAND') ? 'command' : type.toLowerCase();
}
