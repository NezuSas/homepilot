import { renderToStaticMarkup } from 'react-dom/server';
import { SmartDisplayCatalogContent, parseDisplayControlCatalog } from './SmartDisplayControls';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('../lib/apiClient', () => ({ apiFetch: jest.fn() }));

const catalog = {
  deviceId: 'display-1', plan: { id: 2, name: 'Plan Premium', type: 'PREMIUM' },
  commands: [
    { key: 'hp_navigate_home', displayName: 'Inicio', implementationType: 'homepilot',
      controlType: 'button', visibility: 'visible', executableInHomePilot: true, dashboardEligible: true },
    { key: 'hp_volume_set', displayName: 'Volumen', implementationType: 'homepilot',
      controlType: 'slider', visibility: 'visible', executableInHomePilot: true, dashboardEligible: false },
    { key: 'legacy_camera', displayName: 'Cámara', implementationType: 'legacy_adb',
      controlType: 'button', visibility: 'visible', executableInHomePilot: false, dashboardEligible: false },
  ],
};

describe('Smart Display control catalog', () => {
  it('shows plan, local availability and all included commands without an execution button', () => {
    const parsed = parseDisplayControlCatalog(catalog, 'display-1');
    expect(parsed).not.toBeNull();
    expect(parsed?.commands[0].visibility).toBe('visible');
    const html = renderToStaticMarkup(<SmartDisplayCatalogContent catalog={parsed!} />);
    expect(html).toContain('Plan Premium');
    expect(html).toContain('PREMIUM');
    expect(html).toContain('Inicio');
    expect(html).toContain('Volumen');
    expect(html).toContain('Cámara');
    expect(html).toContain('inbox.smart_display.dashboard_available');
    expect(html).toContain('inbox.smart_display.managed_externally');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('inbox.smart_display.apply_volume');
  });

  it('does not show hidden HomePilot or legacy commands in either section', () => {
    const parsed = parseDisplayControlCatalog({ ...catalog, commands: [
      ...catalog.commands,
      { key: 'hidden_homepilot', displayName: 'Oculto HomePilot', implementationType: 'homepilot',
        controlType: 'button', visibility: 'hidden', executableInHomePilot: true, dashboardEligible: true },
      { key: 'hidden_legacy', displayName: 'Oculto legacy', implementationType: 'legacy_adb',
        controlType: 'button', visibility: 'hidden', executableInHomePilot: false, dashboardEligible: false },
    ] }, 'display-1');
    const html = renderToStaticMarkup(<SmartDisplayCatalogContent catalog={parsed!} />);
    expect(html).toContain('Inicio');
    expect(html).toContain('Cámara');
    expect(html).not.toContain('Oculto HomePilot');
    expect(html).not.toContain('Oculto legacy');
  });

  it('shows the legacy plan fallback and a clean empty catalog', () => {
    const parsed = parseDisplayControlCatalog({ deviceId: 'display-1',
      plan: { id: 2, name: null, type: null }, commands: [] }, 'display-1');
    const html = renderToStaticMarkup(<SmartDisplayCatalogContent catalog={parsed!} />);
    expect(html).toContain('inbox.smart_display.plan_fallback');
    expect(html).toContain('inbox.smart_display.no_actions');
    expect(html).not.toContain('<button');
  });

  it('rejects a catalog for another device or with malformed commands', () => {
    expect(parseDisplayControlCatalog(catalog, 'other-device')).toBeNull();
    expect(parseDisplayControlCatalog({ ...catalog, commands: [{ key: 'x', displayName: 'Unsafe' }] }, 'display-1')).toBeNull();
    expect(parseDisplayControlCatalog({ ...catalog, commands: [{ ...catalog.commands[0], visibility: 'private' }] }, 'display-1')).toBeNull();
  });
});
