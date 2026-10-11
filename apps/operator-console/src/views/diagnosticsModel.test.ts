import { TIMEZONE_VALUES, isAdminUserContext } from './diagnosticsModel';

describe('diagnostics model', () => {
  it('offers unique IANA timezones led by the local default', () => {
    expect(new Set(TIMEZONE_VALUES).size).toBe(TIMEZONE_VALUES.length);
    expect(TIMEZONE_VALUES[0]).toBe('America/Guayaquil');
    expect(TIMEZONE_VALUES).toContain('UTC');
    TIMEZONE_VALUES.forEach((zone) => expect(() => new Intl.DateTimeFormat('en', { timeZone: zone })).not.toThrow());
  });

  it('detects the administrator role from the stored user context', () => {
    expect(isAdminUserContext('{"role":"admin"}')).toBe(true);
    expect(isAdminUserContext('{"role":"user"}')).toBe(false);
    expect(isAdminUserContext(null)).toBe(false);
  });
});
