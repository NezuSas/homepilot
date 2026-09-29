import {
  DASHBOARD_BACKGROUND_PRESETS,
  getDashboardBackgroundPresetIdBySource,
  type DashboardBackgroundPresetId,
} from '../../../../packages/topology/domain/DashboardBackgroundPresets';

export interface DashboardBackgroundPreset {
  id: string;
  src: string;
  labelKey: string;
  descriptionKey: string;
}

const PRESET_UI_METADATA: Record<DashboardBackgroundPresetId, Pick<DashboardBackgroundPreset, 'labelKey' | 'descriptionKey'>> = {
  'warm-graphite-residence': {
    labelKey: 'dashboards.view_config.background_presets.warm_graphite.label',
    descriptionKey: 'dashboards.view_config.background_presets.warm_graphite.description',
  },
  'mineral-dawn': {
    labelKey: 'dashboards.view_config.background_presets.mineral_dawn.label',
    descriptionKey: 'dashboards.view_config.background_presets.mineral_dawn.description',
  },
  'copper-horizon': {
    labelKey: 'dashboards.view_config.background_presets.copper_horizon.label',
    descriptionKey: 'dashboards.view_config.background_presets.copper_horizon.description',
  },
  'quiet-atrium': {
    labelKey: 'dashboards.view_config.background_presets.quiet_atrium.label',
    descriptionKey: 'dashboards.view_config.background_presets.quiet_atrium.description',
  },
  'homepilot-amber-residence': {
    labelKey: 'dashboards.view_config.background_presets.amber_residence.label',
    descriptionKey: 'dashboards.view_config.background_presets.amber_residence.description',
  },
};

export const dashboardBackgroundPresets: readonly DashboardBackgroundPreset[] = DASHBOARD_BACKGROUND_PRESETS.map(
  (preset) => ({ ...preset, ...PRESET_UI_METADATA[preset.id] }),
);

export function getDashboardBackgroundSource(background: string, apiBaseUrl: string): string {
  const isBundledBackground = getDashboardBackgroundPresetIdBySource(background) !== undefined;
  if (isBundledBackground || !background.startsWith('/')) return background;
  return `${apiBaseUrl}${background}`;
}
