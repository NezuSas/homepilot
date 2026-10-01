import { renderToStaticMarkup } from 'react-dom/server';
import { ManagedDeviceTile } from './ManagedDeviceTile';
import { DeviceInspectorInfoTab } from './DeviceInspectorTabs';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const device = (type: string): SnapshotDevice => ({ id: 'd', homeId: 'h', roomId: 'r', name: 'Equipo', type, status: 'ASSIGNED', lastKnownState: { on: false } });
describe('Feature: Configuration-only device manager (AC54)', () => {
  it.each(['camera', 'cover', 'light', 'sensor', 'smart_display'])('shows only configuration for %s without operational controls or media', type => {
    const html = renderToStaticMarkup(<ManagedDeviceTile device={device(type)} onInspect={() => {}} />);
    expect(html).toContain('Equipo');
    expect(html).not.toContain('Sala');
    expect(html).toContain('inbox.manage_device');
    expect(html).toContain('aria-label="inbox.manage_device: Equipo"');
    expect(html).not.toContain('device_types.');
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<(video|img)\b|aria-pressed|camera.open_viewer|data-action-state/);
  });
  it.each(['light', 'cover'])('keeps inspector configuration but removes %s commands in manager mode', type => {
    const noop = () => {};
    const html = renderToStaticMarkup(<DeviceInspectorInfoTab device={{ ...device(type), externalId: 'ha:test' }} rooms={[]}
      configurationOnly unavailable={false} isOnline isActionLoading={false} isRefreshing={false} error={null}
      onSemanticTypeChange={noop} onInvertStateChange={noop} onCommand={noop} onRefresh={noop} onMove={noop} onUnassign={noop} onDelete={noop} />);
    expect(html).toContain('inbox.device_inspector.device_function');
    expect(html).toContain('inbox.inspector.actions.unassign');
    expect(html).not.toMatch(/inbox.inspector.actions.(force_on|force_off|toggle|open|close|stop)</);
  });
});
