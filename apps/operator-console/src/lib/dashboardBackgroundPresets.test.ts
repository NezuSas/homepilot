import {
  dashboardBackgroundPresets,
  getDashboardBackgroundSource,
} from './dashboardBackgroundPresets';

describe('dashboard background presets', () => {
  it('ships four unique local backgrounds', () => {
    expect(dashboardBackgroundPresets).toHaveLength(4);
    expect(new Set(dashboardBackgroundPresets.map((preset) => preset.src)).size).toBe(4);
    expect(dashboardBackgroundPresets.every((preset) => preset.src.startsWith('/dashboard-backgrounds/'))).toBe(true);
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
