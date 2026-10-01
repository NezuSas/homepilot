import { renderToStaticMarkup } from 'react-dom/server';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { TopologyDeviceTile } from './TopologyDeviceTile';

jest.mock('../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../../components/CameraMediaFrame', () => ({ CameraMediaFrame: () => null }));
jest.mock('../dashboards/components/IconPicker', () => ({ getDashboardIconComponent: () => 'svg' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'dashboard.editor.sections.sensor_unavailable': 'Sin lectura',
  'topology.momentary_action': 'Acción momentánea',
  'device_states.off': 'Apagado',
  'device_states.unavailable': 'No disponible',
} as Record<string, string>)[key] ?? key }) }));

const device = (extra: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id: 'd', homeId: 'h', roomId: 'r', name: 'Lámpara', type: 'light', status: 'ASSIGNED', lastKnownState: { on: false }, ...extra,
});
const render = (value: SnapshotDevice) => renderToStaticMarkup(<TopologyDeviceTile device={value} onCommand={async () => null} />);

describe('Room Dashboard presenters (AC24, AC25)', () => {
  it('presents a light as a named toggle without the redundant lighting subtitle', () => {
    const html = render(device());
    expect(html).toContain('<button');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Lámpara');
    expect(html).not.toContain('Iluminación');
  });
  it('shows momentary controls without toggle semantics', () => {
    const html = render(device({ type: 'sensor', semanticType: 'light', capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] }));
    expect(html).toContain('Acción momentánea');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('Apagado');
  });
  it('keeps a sensor without reading informational and non-interactive', () => {
    const html = render(device({ type: 'sensor', lastKnownState: null }));
    expect(html).toContain('Sin lectura');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Apagado');
  });
  it('disables an unavailable light rather than reporting it as off', () => {
    const html = render(device({ lastKnownState: { state: 'unavailable' } }));
    expect(html).toContain('disabled');
    expect(html).toContain('No disponible');
    expect(html).not.toContain('Apagado');
    expect(html).not.toContain('aria-pressed');
  });
  it('presents a camera with its own connecting/media surface, not a generic device command', () => {
    const html = render(device({ type: 'camera' }));
    expect(html).toContain('Lámpara');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<video');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('camera.connecting');
  });
});
