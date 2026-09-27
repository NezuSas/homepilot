import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Android Display bridge optional Docker contract', () => {
  const linux = read('docker-compose.android-display.yml');
  const desktop = read('docker-compose.android-display.desktop.yml');
  const dockerfile = read('services/android-display-bridge/Dockerfile');

  it('keeps Linux API on host networking and publishes bridge HTTP only on host loopback', () => {
    expect(linux).toContain('127.0.0.1:${HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT:-5002}:5002');
    expect(linux).toContain('HOMEPILOT_DISPLAY_BRIDGE_URL: http://127.0.0.1:');
    expect(linux).toContain('HOMEPILOT_DISPLAY_BRIDGE_TOKEN: ${HOMEPILOT_DISPLAY_BRIDGE_TOKEN:?');
    expect(linux).toContain('HOMEPILOT_DISPLAY_ADB_CIDRS: ${HOMEPILOT_DISPLAY_ADB_CIDRS:?');
    expect(linux).not.toMatch(/(?:ports:|EXPOSE)[\s\S]*5037/);
    expect(dockerfile).not.toContain('EXPOSE 5037');
  });

  it('uses Docker service DNS and no host HTTP port on Desktop', () => {
    expect(desktop).toContain('HOMEPILOT_DISPLAY_BRIDGE_URL: http://homepilot-display-bridge:5002');
    expect(desktop).toContain('ports: !override []');
    expect(desktop).toContain('homepilot_display_bridge');
  });

  it('persists the non-root ADB home instead of /root/.android', () => {
    expect(dockerfile).toContain('USER 10001:10001');
    expect(dockerfile).toContain('HOME=/var/lib/homepilot-display-adb');
    expect(linux).toContain(':/var/lib/homepilot-display-adb/.android');
    expect(desktop).toContain('homepilot_display_adb_home:/var/lib/homepilot-display-adb/.android');
    expect(dockerfile).not.toContain('/root/.android');
  });
});
