import {
  dashboardBackgroundPresets,
  getDashboardBackgroundSource,
} from './dashboardBackgroundPresets';
import {
  DASHBOARD_BACKGROUND_PRESETS,
  getDashboardBackgroundPreset,
  getDashboardBackgroundPresetIdBySource,
  isDashboardBackgroundPresetId,
} from '../../../../packages/topology/domain/DashboardBackgroundPresets';

describe('dashboard background presets', () => {
  it('ships four unique local backgrounds', () => {
    expect(dashboardBackgroundPresets).toHaveLength(4);
    expect(new Set(dashboardBackgroundPresets.map((preset) => preset.src)).size).toBe(4);
    expect(dashboardBackgroundPresets.every((preset) => preset.src.startsWith('/dashboard-backgrounds/'))).toBe(true);
  });

  it('uses the same canonical IDs and sources as dashboard export/import', () => {
    expect(dashboardBackgroundPresets.map(({ id, src }) => ({ id, src }))).toEqual(DASHBOARD_BACKGROUND_PRESETS);
    for (const preset of DASHBOARD_BACKGROUND_PRESETS) {
      expect(getDashboardBackgroundPreset(preset.id)?.src).toBe(preset.src);
      expect(getDashboardBackgroundPresetIdBySource(preset.src)).toBe(preset.id);
      expect(isDashboardBackgroundPresetId(preset.id)).toBe(true);
    }
    expect(isDashboardBackgroundPresetId('uploaded-background')).toBe(false);
    expect(getDashboardBackgroundPresetIdBySource('/uploads/background.png')).toBeUndefined();
  });

  it('keeps bundled backgrounds on the operator-console origin', () => {
    expect(
      getDashboardBackgroundSource(
        '/dashboard-backgrounds/warm-graphite-residence.png',
        'http://localhost:3000',
      ),
    ).toBe('/dashboard-backgrounds/warm-graphite-residence.png');
  });

  it('retains the API path for uploaded files and data URLs', () => {
    expect(getDashboardBackgroundSource('/uploads/background.png', 'http://localhost:3000')).toBe(
      'http://localhost:3000/uploads/background.png',
    );
    expect(getDashboardBackgroundSource('data:image/png;base64,abc', 'http://localhost:3000')).toBe(
      'data:image/png;base64,abc',
    );
  });
});
