import { renderToStaticMarkup } from 'react-dom/server';
import { SmartDisplayActionControls, selectSmartDisplayControls } from './SmartDisplayControls';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('../lib/apiClient', () => ({ apiFetch: jest.fn() }));

const action = (semanticAction: string, controlType: string, overrides: Record<string, unknown> = {}) => ({
  semanticAction, controlType, visibility: 'visible', requiresConfirmation: false, ...overrides,
});

describe('Smart Display effective controls', () => {
  it('renders only controls returned for this device, without unsupported actions', () => {
    const actions = selectSmartDisplayControls({ deviceId: 'display-1', actions: [
      action('navigate_home', 'button'), action('navigate_back', 'button'),
    ] }, 'display-1');
    const html = renderToStaticMarkup(<SmartDisplayActionControls actions={actions} disabled={false}
      busyAction={null} volume={50} onVolumeChange={jest.fn()} onAction={jest.fn()} />);
    expect(html).toContain('inbox.smart_display.home');
    expect(html).toContain('inbox.smart_display.back');
    expect(html).not.toContain('inbox.smart_display.volume');
    expect(html).not.toContain('sleep');
  });

  it('fails closed for a different device, hidden actions and incompatible controls', () => {
    expect(selectSmartDisplayControls({ deviceId: 'other', actions: [action('navigate_home', 'button')] }, 'display-1')).toEqual([]);
    expect(selectSmartDisplayControls({ deviceId: 'display-1', actions: [
      action('navigate_home', 'slider'), action('volume_set', 'button'),
      action('navigate_back', 'button', { visibility: 'hidden' }),
      action('navigate_back', 'button', { requiresConfirmation: true }),
      action('reboot', 'button'),
    ] }, 'display-1')).toEqual([]);
  });

  it('shows an empty state when the effective action list is empty', () => {
    const html = renderToStaticMarkup(<SmartDisplayActionControls actions={[]} disabled={false}
      busyAction={null} volume={50} onVolumeChange={jest.fn()} onAction={jest.fn()} />);
    expect(html).toContain('inbox.smart_display.no_actions');
    expect(html).not.toContain('<button');
  });

  it('shows three valid actions and a deliberate volume confirmation', () => {
    const actions = selectSmartDisplayControls({ deviceId: 'display-1', actions: [
      action('navigate_home', 'button'), action('navigate_back', 'button'), action('volume_set', 'slider'),
    ] }, 'display-1');
    expect(actions).toEqual(['navigate_home', 'navigate_back', 'volume_set']);
    const html = renderToStaticMarkup(<SmartDisplayActionControls actions={actions} disabled={false}
      busyAction={null} volume={70} onVolumeChange={jest.fn()} onAction={jest.fn()} />);
    expect(html).toContain('inbox.smart_display.apply_volume');
    expect(html).toContain('70%');
  });
});
