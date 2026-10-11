import { CLOUD_TONES, getParticleX, getWeatherCategory, SIZE_PX } from './weatherSceneModel';

describe('weatherSceneModel', () => {
  it.each([
    [0, true, 'clear-day'],
    [0, false, 'clear-night'],
    [2, true, 'partly-cloudy-day'],
    [1, false, 'partly-cloudy-night'],
    [3, true, 'cloudy'],
    [45, true, 'fog'],
    [55, true, 'drizzle'],
    [82, true, 'rain'],
    [86, true, 'snow'],
    [99, true, 'storm'],
    [1234, true, 'cloudy'],
  ] as const)('maps code %s (daytime %s) to %s', (code, isDaytime, expected) => {
    expect(getWeatherCategory(code, isDaytime)).toBe(expected);
  });

  it('spreads particles across the cloud base without dividing by zero', () => {
    expect(getParticleX(0, 5)).toBe(20);
    expect(getParticleX(4, 5)).toBe(44);
    expect(getParticleX(0, 1)).toBe(20);
  });

  it('keeps the pinned palette and icon sizes', () => {
    expect(CLOUD_TONES.day.top).toBe('#ffffff');
    expect(SIZE_PX).toEqual({ sm: 28, md: 56, lg: 108 });
  });
});
