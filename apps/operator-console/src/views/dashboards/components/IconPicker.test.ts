import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Camera, CircleHelp } from 'lucide-react';
import { mdiCamera, mdiPool } from '@mdi/js';
import { getDashboardIconComponent, IconPicker, MAX_RENDERED_ICONS } from './IconPicker';
import {
  chooseDashboardIcon, DASHBOARD_ICON_DEFAULTS, getDashboardFallbackIconComponent,
  isDashboardIconAvailable, limitDashboardMdiIcons, loadDashboardMdiCatalog,
  searchDashboardMdiIcons,
} from './dashboardIconRegistry';
import { getDefaultIcon } from '../widgets/sectionCardCatalog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key === 'dashboard.editor.sections.icon_picker_unavailable'
    ? 'Icon unavailable' : key }),
}));

jest.mock('../../../components/ui/ComponentSkeletons', () => ({
  IconPickerSkeleton: () => null,
}));

describe('Dashboard MDI icons', () => {
  it('resolves a valid canonical MDI to its official path', () => {
    const html = renderToStaticMarkup(createElement(getDashboardIconComponent('mdi:camera')));
    expect(html).toContain(mdiCamera);
    expect(isDashboardIconAvailable('mdi:camera')).toBe(true);
  });

  it('renders a saved MDI outside the eagerly imported defaults after catalog load', async () => {
    await loadDashboardMdiCatalog();
    expect(isDashboardIconAvailable('mdi:pool')).toBe(true);
    expect(renderToStaticMarkup(createElement(getDashboardIconComponent('mdi:pool')))).toContain(mdiPool);
  });

  it('keeps every new card default canonical and present in the installed MDI catalog', async () => {
    const catalog = await loadDashboardMdiCatalog();
    for (const name of Object.values(DASHBOARD_ICON_DEFAULTS)) {
      expect(name).toMatch(/^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(catalog.byName.has(name)).toBe(true);
      expect(isDashboardIconAvailable(name, catalog)).toBe(true);
    }
    expect(getDefaultIcon('action')).toBe('mdi:cursor-default-click');
    expect(catalog.byName.has(getDefaultIcon('action'))).toBe(true);
    expect(() => renderToStaticMarkup(createElement(getDashboardIconComponent(getDefaultIcon('action'))))).not.toThrow();
  });

  it('preserves historic Lucide and MDI values without rewriting them', () => {
    expect(getDashboardIconComponent('Camera')).toBe(Camera);
    expect(isDashboardIconAvailable('MousePointerClick')).toBe(true);
    expect(renderToStaticMarkup(createElement(getDashboardIconComponent('mdi:lightbulb')))).toContain('<svg');
  });

  it('preserves an unknown stored string, renders fallback and shows one editor warning', async () => {
    const catalog = await loadDashboardMdiCatalog();
    const stored = 'mdi:missing-old-icon';
    const onChange = jest.fn();
    expect(isDashboardIconAvailable(stored, catalog)).toBe(false);
    expect(getDashboardIconComponent(stored)).toBe(getDashboardFallbackIconComponent());
    const html = renderToStaticMarkup(createElement(getDashboardIconComponent(stored)));
    expect(html).toContain('<svg');
    expect(getDashboardFallbackIconComponent()).toBe(CircleHelp);
    chooseDashboardIcon(stored, onChange, catalog);
    expect(onChange).not.toHaveBeenCalled();
    expect(stored).toBe('mdi:missing-old-icon');
    const editor = renderToStaticMarkup(createElement(IconPicker, { value: stored, onChange }));
    expect(editor.match(/Icon unavailable/g)).toHaveLength(1);
    expect(editor).toContain(stored);
  });

  it('keeps an unknown legacy string visible without changing its value', () => {
    const onChange = jest.fn();
    const html = renderToStaticMarkup(createElement(IconPicker, { value: 'OldCustomIcon', onChange }));
    expect(getDashboardIconComponent('OldCustomIcon')).toBe(CircleHelp);
    expect(html).toContain('OldCustomIcon');
    expect(html.match(/Icon unavailable/g)).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('searches the full library by partial name and Spanish/English aliases, ignoring case and accents', async () => {
    const catalog = await loadDashboardMdiCatalog();
    for (const [term, expected] of [
      ['Camara', 'mdi:camera'], ['CÁMARA', 'mdi:camera'], ['camera', 'mdi:camera'],
      ['LUZ', 'mdi:lightbulb'], ['light', 'mdi:lightbulb'], ['bombillo', 'mdi:lightbulb'],
      ['puerta', 'mdi:door'], ['door', 'mdi:door'],
      ['cerradura', 'mdi:lock'], ['lock', 'mdi:lock'],
      ['wifi', 'mdi:wifi'], ['red', 'mdi:wifi'], ['network', 'mdi:wifi'],
      ['bateria', 'mdi:battery'], ['batería', 'mdi:battery'], ['battery', 'mdi:battery'],
      ['solar', 'mdi:solar-panel'], ['panel', 'mdi:solar-panel'],
      ['energia', 'mdi:flash'], ['energía', 'mdi:flash'], ['energy', 'mdi:flash'],
      ['volumen', 'mdi:volume-high'], ['volume', 'mdi:volume-high'], ['audio', 'mdi:volume-high'],
      ['television', 'mdi:television'], ['tv', 'mdi:television'], ['media', 'mdi:television'],
      ['persiana', 'mdi:blinds'], ['blind', 'mdi:blinds'], ['cortina', 'mdi:blinds'],
      ['temperatura', 'mdi:thermometer'], ['temperature', 'mdi:thermometer'], ['clima', 'mdi:thermometer'],
      ['agua', 'mdi:water'], ['water', 'mdi:water'], ['bomba', 'mdi:pump'], ['pump', 'mdi:pump'],
      ['piscina', 'mdi:pool'], ['pool', 'mdi:pool'], ['alarma', 'mdi:alarm'], ['alarm', 'mdi:alarm'],
      ['seguridad', 'mdi:shield'], ['security', 'mdi:shield'], ['sensor', 'mdi:motion-sensor'],
    ]) {
      expect(searchDashboardMdiIcons(term, catalog).map((entry) => entry.name)).toContain(expected);
    }
  });

  it('offers a broad catalog but bounds rendered results and pins the current selection', async () => {
    const catalog = await loadDashboardMdiCatalog();
    expect(catalog.entries.length).toBeGreaterThan(7000);
    const selected = catalog.entries[catalog.entries.length - 1].name;
    const visible = limitDashboardMdiIcons(catalog.entries, selected, 60);
    expect(visible).toHaveLength(60);
    expect(visible[0].name).toBe(selected);
    expect(visible.filter((entry) => entry.name === selected)).toHaveLength(1);
    expect(MAX_RENDERED_ICONS).toBeLessThan(1000);
    expect(limitDashboardMdiIcons(catalog.entries, selected, MAX_RENDERED_ICONS)).toHaveLength(MAX_RENDERED_ICONS);
  });

  it('does not persist search text, but commits an explicit MDI choice once', async () => {
    const catalog = await loadDashboardMdiCatalog();
    const onChange = jest.fn();
    searchDashboardMdiIcons('cam', catalog);
    expect(onChange).not.toHaveBeenCalled();
    chooseDashboardIcon('Camera', onChange, catalog);
    expect(onChange).not.toHaveBeenCalled();
    chooseDashboardIcon('mdi:camera', onChange, catalog);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('mdi:camera');
  });
});
