import type { AndroidDisplaySource, AndroidDisplayTestResult } from './androidDisplayApi';

export type DisplayIssue = 'invalid_ip' | 'duplicate_endpoint' | 'duplicate_android_id' |
  'duplicate_unknown' | 'offline' | 'authorization' | 'identity_mismatch' | 'bridge' | 'unknown';

export function validPrivateIpv4(value: string): boolean {
  const parts = value.trim().split('.');
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return false;
  const [first, second] = parts.map(Number);
  return first === 10 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
}

export function duplicateKind(displays: readonly AndroidDisplaySource[], host: string,
  test: AndroidDisplayTestResult | null): DisplayIssue | null {
  if (displays.some(display => display.adbHost === host && display.adbPort === 5555)) return 'duplicate_endpoint';
  const id = test?.metadata.androidId;
  if (id && displays.some(display => display.metadata.androidId === id)) return 'duplicate_android_id';
  return null;
}

export function displayIssue(code: string, knownDuplicate: DisplayIssue | null = null): DisplayIssue {
  if (code === 'INVALID_ADB_ENDPOINT' || code === 'ADB_ENDPOINT_NOT_ALLOWED' || code === 'VALIDATION_ERROR') return 'invalid_ip';
  if (code === 'DISPLAY_ALREADY_EXISTS') return knownDuplicate ?? 'duplicate_unknown';
  if (code === 'DISPLAY_NEEDS_AUTHORIZATION' || code === 'ADB_UNAUTHORIZED') return 'authorization';
  if (code === 'DISPLAY_OFFLINE' || code === 'ADB_OFFLINE' || code === 'DISPLAY_NOT_CONNECTED') return 'offline';
  if (code === 'IDENTITY_MISMATCH') return 'identity_mismatch';
  if (code.startsWith('BRIDGE_') || code === 'ADB_TIMEOUT' || code === 'DISPLAY_BUSY') return 'bridge';
  return 'unknown';
}
