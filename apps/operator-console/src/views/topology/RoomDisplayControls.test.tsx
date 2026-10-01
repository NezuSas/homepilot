import { renderToStaticMarkup } from 'react-dom/server';
import { RoomDisplayCatalog } from './RoomDisplayControls';
import type { DisplayControlCatalog } from '../../components/SmartDisplayControls';
jest.mock('../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../dashboards/components/IconPicker', () => ({ getDashboardIconComponent: () => 'svg' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const command = { key: 'home', displayName: 'Inicio', implementationType: 'homepilot' as const, controlType: 'button' as const, visibility: 'visible' as const, executableInHomePilot: true, dashboardEligible: true };
const catalog: DisplayControlCatalog = { deviceId: 'display', plan: { id: 1, name: null, type: null }, commands: [command,
  { ...command, key: 'remote', displayName: 'TV', implementationType: 'legacy_adb' },
  { ...command, key: 'hidden', displayName: 'Oculto', visibility: 'hidden' },
  { ...command, key: 'slider', displayName: 'Volumen', controlType: 'slider', dashboardEligible: false },
  { ...command, key: 'unavailable', displayName: 'Pendiente', executableInHomePilot: false, dashboardEligible: false },
  { ...command, key: 'confirm', displayName: 'Confirmable', dashboardEligible: false },
] };
describe('Feature: Room display commands (AC26)', () => {
  it('uses momentary Dashboard buttons only for visible authorized, eligible commands', () => {
    const html = renderToStaticMarkup(<RoomDisplayCatalog catalog={catalog} device={{ id: 'display', name: 'Pizarra oficina', homeId: 'h', roomId: 'r', type: 'smart_display', status: 'ASSIGNED', lastKnownState: { connectionState: 'online' } }} />);
    expect(html.match(/<button\b/g)).toHaveLength(2);
    expect(html).toContain('Inicio');
    expect(html).toContain('TV');
    expect(html).toContain('Volumen');
    expect(html).toContain('Pendiente');
    expect(html).not.toContain('Oculto');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('legacy_adb');
  });
});
