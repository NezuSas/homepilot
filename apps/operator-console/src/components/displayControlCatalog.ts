export interface DisplayCatalogCommand {
  key: string;
  displayName: string;
  implementationType: 'homepilot' | 'legacy_adb';
  controlType: 'button' | 'slider';
  visibility: 'visible' | 'hidden';
  executableInHomePilot: boolean;
  dashboardEligible: boolean;
}

export interface DisplayControlCatalog {
  deviceId: string;
  plan: { id: number; name: string | null; type: string | null };
  commands: DisplayCatalogCommand[];
}

export function parseDisplayControlCatalog(value: unknown, deviceId: string): DisplayControlCatalog | null {
  if (!value || typeof value !== 'object' || !('deviceId' in value) || value.deviceId !== deviceId
    || !('plan' in value) || !value.plan || typeof value.plan !== 'object'
    || !('commands' in value) || !Array.isArray(value.commands)) return null;
  const plan = value.plan;
  if (!('id' in plan) || typeof plan.id !== 'number' || !Number.isSafeInteger(plan.id) || plan.id <= 0
    || !('name' in plan) || (plan.name !== null && typeof plan.name !== 'string')
    || !('type' in plan) || (plan.type !== null && typeof plan.type !== 'string')) return null;
  const commands: DisplayCatalogCommand[] = [];
  for (const item of value.commands) {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string'
      || typeof item.displayName !== 'string'
      || (item.implementationType !== 'homepilot' && item.implementationType !== 'legacy_adb')
      || (item.controlType !== 'button' && item.controlType !== 'slider')
      || (item.visibility !== 'visible' && item.visibility !== 'hidden')
      || typeof item.executableInHomePilot !== 'boolean'
      || typeof item.dashboardEligible !== 'boolean') return null;
    commands.push({ key: item.key, displayName: item.displayName,
      implementationType: item.implementationType, controlType: item.controlType, visibility: item.visibility,
      executableInHomePilot: item.executableInHomePilot, dashboardEligible: item.dashboardEligible });
  }
  return { deviceId, plan: { id: plan.id, name: plan.name, type: plan.type }, commands };
}
