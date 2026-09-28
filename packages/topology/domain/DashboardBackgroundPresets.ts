/** Portable identities for backgrounds bundled with every HomePilot installation. */
export const DASHBOARD_BACKGROUND_PRESETS = [
  { id: 'warm-graphite-residence', src: '/dashboard-backgrounds/warm-graphite-residence.png' },
  { id: 'mineral-dawn', src: '/dashboard-backgrounds/mineral-dawn.png' },
  { id: 'copper-horizon', src: '/dashboard-backgrounds/copper-horizon.png' },
  { id: 'quiet-atrium', src: '/dashboard-backgrounds/quiet-atrium.png' },
] as const;

export type DashboardBackgroundPresetId = typeof DASHBOARD_BACKGROUND_PRESETS[number]['id'];

export function getDashboardBackgroundPreset(id: string) {
  return DASHBOARD_BACKGROUND_PRESETS.find((preset) => preset.id === id);
}

export function getDashboardBackgroundPresetIdBySource(source: string | undefined): DashboardBackgroundPresetId | undefined {
  return DASHBOARD_BACKGROUND_PRESETS.find((preset) => preset.src === source)?.id;
}

export function isDashboardBackgroundPresetId(id: string): id is DashboardBackgroundPresetId {
  return getDashboardBackgroundPreset(id) !== undefined;
}
