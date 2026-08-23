export interface DashboardBackgroundPreset {
  id: string;
  src: string;
  labelKey: string;
  descriptionKey: string;
}

export const dashboardBackgroundPresets: readonly DashboardBackgroundPreset[] = [
  {
    id: 'warm-graphite-residence',
    src: '/dashboard-backgrounds/warm-graphite-residence.png',
    labelKey: 'dashboards.view_config.background_presets.warm_graphite.label',
    descriptionKey: 'dashboards.view_config.background_presets.warm_graphite.description',
  },
  {
    id: 'mineral-dawn',
    src: '/dashboard-backgrounds/mineral-dawn.png',
    labelKey: 'dashboards.view_config.background_presets.mineral_dawn.label',
    descriptionKey: 'dashboards.view_config.background_presets.mineral_dawn.description',
  },
  {
    id: 'copper-horizon',
    src: '/dashboard-backgrounds/copper-horizon.png',
    labelKey: 'dashboards.view_config.background_presets.copper_horizon.label',
    descriptionKey: 'dashboards.view_config.background_presets.copper_horizon.description',
  },
  {
    id: 'quiet-atrium',
    src: '/dashboard-backgrounds/quiet-atrium.png',
    labelKey: 'dashboards.view_config.background_presets.quiet_atrium.label',
    descriptionKey: 'dashboards.view_config.background_presets.quiet_atrium.description',
  },
];

export function getDashboardBackgroundSource(background: string, apiBaseUrl: string): string {
  const isBundledBackground = dashboardBackgroundPresets.some((preset) => preset.src === background);
  if (isBundledBackground || !background.startsWith('/')) return background;
  return `${apiBaseUrl}${background}`;
}
