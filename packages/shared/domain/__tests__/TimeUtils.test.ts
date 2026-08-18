import { DateTime, Settings } from 'luxon';
import { TimeUtils } from '../utils/TimeUtils';

describe('TimeUtils', () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 0, 15, 12, 0, 0);
  });
  afterEach(() => { Settings.now = originalNow; });

  it('converts a local IANA time to UTC using the current date', () => {
    expect(TimeUtils.convertLocalToUTC('08:30', 'America/Guayaquil')).toBe('13:30');
    expect(TimeUtils.convertLocalToUTC('08:30', 'Europe/Madrid')).toBe('07:30');
  });

  it('rejects invalid local times or zones', () => {
    expect(() => TimeUtils.convertLocalToUTC('not-a-time', 'Invalid/Zone')).toThrow('Hora o zona horaria inválida');
  });

  it('returns the browser time zone and falls back to UTC when it is absent', () => {
    const resolvedOptions = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
    resolvedOptions.mockReturnValue({ locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'America/Guayaquil' });
    expect(TimeUtils.detectBrowserTimezone()).toBe('America/Guayaquil');
    resolvedOptions.mockReturnValue({ locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: '' });
    expect(TimeUtils.detectBrowserTimezone()).toBe('UTC');
    resolvedOptions.mockRestore();
  });
});