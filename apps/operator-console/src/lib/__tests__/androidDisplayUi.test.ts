import { displayIssue, duplicateKind, validPrivateIpv4 } from '../androidDisplayUi';
import type { AndroidDisplaySource, AndroidDisplayTestResult } from '../androidDisplayApi';

const metadata = { adbSerial: null, androidId: 'physical-1', manufacturer: 'Droidlogic',
  model: 'Board', androidVersion: '11', resolution: '3840x2160', densityDpi: 480,
  screenState: 'unknown' as const };
const display: AndroidDisplaySource = { deviceId: 'device-1', homeId: 'home-1', adbHost: '192.168.1.37',
  adbPort: 5555, connectionState: 'online', lastSeenAt: null, metadata };
const test: AndroidDisplayTestResult = { connectionState: 'online', metadata };

describe('Android Display UI safety rules', () => {
  it('accepts only private IPv4; backend still enforces the configured CIDR', () => {
    expect(validPrivateIpv4('192.168.1.37')).toBe(true);
    expect(validPrivateIpv4('10.0.0.5')).toBe(true);
    expect(validPrivateIpv4('172.31.0.5')).toBe(true);
    for (const host of ['8.8.8.8', '127.0.0.1', '172.32.0.5', '192.168.1.999', 'example.com', '192.168.01.37']) {
      expect(validPrivateIpv4(host)).toBe(false);
    }
  });

  it('distinguishes known endpoint and Android ID duplicates without exposing identity as primary UI', () => {
    expect(duplicateKind([display], '192.168.1.37', null)).toBe('duplicate_endpoint');
    expect(duplicateKind([display], '192.168.1.38', test)).toBe('duplicate_android_id');
    expect(duplicateKind([display], '192.168.1.38', null)).toBeNull();
  });

  it('maps safe error codes to actionable categories and keeps unknown errors generic', () => {
    expect(displayIssue('DISPLAY_NEEDS_AUTHORIZATION')).toBe('authorization');
    expect(displayIssue('ADB_OFFLINE')).toBe('offline');
    expect(displayIssue('BRIDGE_TIMEOUT')).toBe('bridge');
    expect(displayIssue('INVALID_ADB_ENDPOINT')).toBe('invalid_ip');
    expect(displayIssue('DISPLAY_ALREADY_EXISTS', 'duplicate_android_id')).toBe('duplicate_android_id');
    expect(displayIssue('DISPLAY_ALREADY_EXISTS')).toBe('duplicate_unknown');
    expect(displayIssue('SENSITIVE_INTERNAL_TEXT')).toBe('unknown');
  });
});
