import { renderToStaticMarkup } from 'react-dom/server';
import { SmartDisplayCatalogContent, parseDisplayControlCatalog } from './SmartDisplayControls';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'inbox.smart_display.current_plan': 'Plan actual',
  'inbox.smart_display.included_controls': 'Comandos incluidos en tu plan',
  'inbox.smart_display.dashboard_available': 'Disponible en Dashboard',
  'inbox.smart_display.control_available': 'Control disponible',
  'inbox.smart_display.included_in_plan': 'Incluido en tu plan',
  'inbox.smart_display.no_actions': 'No hay comandos visibles en tu plan.',
} as Record<string, string>)[key] ?? key }) }));
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
      controlType: 'button', visibility: 'visible', executableInHomePilot: true, dashboardEligible: true },
    { key: 'not_available', displayName: 'Pendiente', implementationType: 'legacy_adb',
      controlType: 'button', visibility: 'visible', executableInHomePilot: false, dashboardEligible: false },
  ],
};

describe('Smart Display control catalog', () => {
  it('shows the current plan and one list of included commands without exposing implementation details', () => {
    const parsed = parseDisplayControlCatalog(catalog, 'display-1');
    expect(parsed).not.toBeNull();
    expect(parsed?.commands[0].visibility).toBe('visible');
    const html = renderToStaticMarkup(<SmartDisplayCatalogContent catalog={parsed!} />);
    expect(html).toContain('Plan actual');
    expect(html).toContain('Plan Premium');
    expect(html).toContain('PREMIUM');
    expect(html).toContain('Comandos incluidos en tu plan');
    expect(html.match(/<section\b/g)).toHaveLength(2);
    expect(html).not.toContain('Controles HomePilot');
    expect(html).not.toContain('Otros incluidos en el plan');
    expect(html).toContain('Inicio');
    expect(html).toContain('Volumen');
    expect(html).toContain('Cámara');
    expect(html).toContain('Pendiente');
    expect(html.indexOf('Inicio')).toBeLessThan(html.indexOf('Volumen'));
    expect(html.indexOf('Volumen')).toBeLessThan(html.indexOf('Cámara'));
    expect(html).toContain('Disponible en Dashboard');
    expect(html.match(/Disponible en Dashboard/g)).toHaveLength(2);
    expect(html).toContain('Control disponible');
    expect(html).toContain('Incluido en tu plan');
    expect(html).not.toContain('legacy_adb');
    expect(html).not.toContain('homepilot');
    expect(html).not.toContain('Gestionado por NEZU');
    expect(html).not.toContain('<button');
  });

  it('does not show hidden HomePilot or legacy commands in the included list', () => {
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
    expect(html).not.toContain('legacy_adb');
  });

  it('shows the legacy plan fallback and a clean empty catalog', () => {
    const parsed = parseDisplayControlCatalog({ deviceId: 'display-1',
      plan: { id: 2, name: null, type: null }, commands: [] }, 'display-1');
    const html = renderToStaticMarkup(<SmartDisplayCatalogContent catalog={parsed!} />);
    expect(html).toContain('inbox.smart_display.plan_fallback');
    expect(html).toContain('No hay comandos visibles en tu plan.');
    expect(html).not.toContain('<button');
  });

  it('rejects a catalog for another device or with malformed commands', () => {
    expect(parseDisplayControlCatalog(catalog, 'other-device')).toBeNull();
    expect(parseDisplayControlCatalog({ ...catalog, commands: [{ key: 'x', displayName: 'Unsafe' }] }, 'display-1')).toBeNull();
    expect(parseDisplayControlCatalog({ ...catalog, commands: [{ ...catalog.commands[0], visibility: 'private' }] }, 'display-1')).toBeNull();
  });
});
