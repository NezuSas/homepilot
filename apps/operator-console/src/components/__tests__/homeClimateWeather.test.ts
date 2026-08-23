import { getHomeClimateTemperature } from '../homeClimateWeather';

const weather = {
  temperature: 18.6,
  code: 3,
  updatedAt: '2026-08-23T10:00:00-05:00',
  location: 'Cuenca',
  label: 'Nublado',
};

describe('getHomeClimateTemperature', () => {
  it('uses the current weather temperature for the configured city', () => {
    expect(getHomeClimateTemperature(weather, 'ready')).toBe(19);
  });

  it.each(['idle', 'loading', 'error'] as const)('keeps the unavailable state while weather is %s', (status) => {
    expect(getHomeClimateTemperature(weather, status)).toBeNull();
  });

  it('rejects a malformed temperature value', () => {
    expect(getHomeClimateTemperature({ ...weather, temperature: Number.NaN }, 'ready')).toBeNull();
  });
});
