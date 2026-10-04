import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceWidget } from './DeviceWidget';
import { SectionCardContent } from './SectionCardContent';
import type { DashboardWidgetConfig } from '../types';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost' }));
jest.mock('../../../components/CameraDeviceTile', () => ({ CameraDeviceTile: () => null }));
jest.mock('./SectionCameraPreview', () => ({ SectionCameraPreview: () => null }));
const mockDevices: SnapshotDevice[] = [];
jest.mock('../../../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: (selector: (state: object) => unknown) => selector({ devices: mockDevices, roomsByHome: {}, upsertDevice: jest.fn(), isLoading: false }) }));
afterEach(() => { mockDevices.length = 0; });
const config: DashboardWidgetConfig = { layout: { x: 0, y: 0, w: 3, h: 2 }, binding: { entityId: 'command', entityType: 'device' }, visibility: { rules: [], defaultState: 'show' }, appearance: {} };
const pulse: SnapshotDevice = { id: 'command', homeId: 'h', roomId: 'r', status: 'ASSIGNED', name: 'Logical command', type: 'switch', integrationSource: 'modbus-tcp', lastKnownState: { plcRole: 'output_command', plcMode: 'pulse', actualState: true, value: true, state: 'on', available: true, writable: true }, capabilities: [{ type: 'switch', name: 'PLC', commands: [{ name: 'press' }, { name: 'pulse' }] }] };

describe('Feature: Momentary PLC action presentation (AC39)', () => {
  it('Scenario: Historical DeviceWidget renders Execute without persistent ON or snapshot mutation', () => {
    mockDevices.push(pulse);
    const before = JSON.stringify(pulse);
    const html = renderToStaticMarkup(<DeviceWidget config={config} isEditing={false} />);
    expect(html).toContain('data-plc-momentary="true"');
    expect(html).toContain('dashboards.widgets.action_button.execute');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('common.on');
    expect(JSON.stringify(pulse)).toBe(before);
  });
  it.each(['output', 'output_command'])('Scenario: %s sustained retains the persistent control', plcRole => {
    mockDevices.push({ ...pulse, lastKnownState: { ...pulse.lastKnownState, plcRole, plcMode: 'sustained', commandState: false, physicalState: true }, capabilities: [{ type: 'switch', name: 'PLC', commands: [{ name: 'turn_on' }, { name: 'turn_off' }] }] });
    const html = renderToStaticMarkup(<DeviceWidget config={config} isEditing={false} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('data-plc-momentary');
  });
  it.each(['device', 'light', 'action'] as const)('Scenario: Historical %s section shows ready action despite actualState ON', kind => {
    const html = renderToStaticMarkup(<SectionCardContent kind={kind} title="Command" span="small" device={pulse} isAssigned isActive onAction={() => {}} />);
    expect(html).toContain('data-plc-momentary="true"');
    expect(html).toContain('data-action-state="idle"');
    expect(html).toContain('dashboards.widgets.action_button.execute');
    expect(html).not.toContain('homepilot-section-light-tile-active');
    expect(html).not.toContain('aria-pressed');
  });
  it('Scenario: Section pending blocks input and reset error returns ready with visible error', () => {
    const render = (actionFeedback: 'pending' | 'error') => renderToStaticMarkup(<SectionCardContent kind="light" title="Command" span="small" device={pulse} isAssigned onAction={() => {}} actionFeedback={actionFeedback} actionError="Pulse reset failed" />);
    expect(render('pending')).toContain('aria-busy="true"');
    expect(render('pending')).toContain('disabled');
    expect(render('error')).toContain('data-action-state="idle"');
    expect(render('error')).toContain('role="alert"');
    expect(render('error')).toContain('Pulse reset failed');
    expect(render('error')).toContain('dashboards.widgets.action_button.execute');
  });
});
