import { DEVICE_ONLINE_WINDOW_MS, isDeviceOnline } from './deviceInspectorModel';

describe('deviceInspectorModel', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');

  it('treats a recent update as online', () => {
    expect(isDeviceOnline('2026-01-01T11:58:00.000Z', now)).toBe(true);
  });

  it('treats an update at or beyond the window as offline', () => {
    const boundary = new Date(now - DEVICE_ONLINE_WINDOW_MS).toISOString();
    expect(isDeviceOnline(boundary, now)).toBe(false);
    expect(isDeviceOnline('2026-01-01T11:00:00.000Z', now)).toBe(false);
  });

  it('treats a missing timestamp as just updated', () => {
    expect(isDeviceOnline(undefined)).toBe(true);
    expect(isDeviceOnline(null)).toBe(true);
  });
});
