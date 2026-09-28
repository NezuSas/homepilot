import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CircleHelp, MousePointerClick } from 'lucide-react';
import { getDashboardIconComponent, IconPicker } from './IconPicker';
import {
  chooseDashboardIcon, DASHBOARD_ICON_CATALOG, DASHBOARD_ICON_DEFAULTS,
  isDashboardIconAvailable, searchDashboardIcons,
} from './dashboardIconRegistry';
import { getDefaultIcon } from '../widgets/sectionCardCatalog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key === 'dashboard.editor.sections.icon_picker_unavailable'
    ? 'Icon unavailable' : key }),
}));

describe('getDashboardIconComponent', () => {
  it('resolves the persisted Home Assistant icon aliases included in the compact catalog', () => {
    expect(getDashboardIconComponent('mdi:lightbulb')).not.toBe(CircleHelp);
    expect(getDashboardIconComponent('mdi:power-plug')).not.toBe(CircleHelp);
    expect(getDashboardIconComponent('mdi:weather-windy')).not.toBe(CircleHelp);
  });

  it('keeps unknown persisted values safe by returning the existing fallback', () => {
    expect(getDashboardIconComponent('mdi:not-an-icon')).toBe(CircleHelp);
    const storedIcon = 'legacy:unavailable';
    const onChange = jest.fn();
    expect(isDashboardIconAvailable(storedIcon)).toBe(false);
    expect(getDashboardIconComponent(storedIcon)).toBe(CircleHelp);
    expect(() => renderToStaticMarkup(createElement(getDashboardIconComponent(storedIcon)))).not.toThrow();
    chooseDashboardIcon(storedIcon, onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(storedIcon).toBe('legacy:unavailable');
    const html = renderToStaticMarkup(createElement(IconPicker, { value: storedIcon, onChange }));
    expect(html.match(/Icon unavailable/g)).toHaveLength(1);
    expect(html).toContain(storedIcon);
  });

  it('uses only registered, renderable defaults including the Action Card icon', () => {
    expect(getDefaultIcon('action')).toBe(DASHBOARD_ICON_DEFAULTS.action);
    expect(getDashboardIconComponent(getDefaultIcon('action'))).toBe(MousePointerClick);
    for (const name of Object.values(DASHBOARD_ICON_DEFAULTS)) {
      expect(isDashboardIconAvailable(name)).toBe(true);
      expect(() => renderToStaticMarkup(createElement(getDashboardIconComponent(name)))).not.toThrow();
    }
  });

  it('finds partial, case-insensitive Spanish and English search terms', () => {
    for (const [term, icon] of [
      ['LUZ', 'Lightbulb'], ['light', 'Lightbulb'], ['cáma', 'Camera'],
      ['camera', 'Camera'], ['wifi', 'Wifi'], ['volumen', 'Volume2'],
      ['volume', 'Volume2'], ['cerradura', 'Lock'], ['lock', 'Lock'],
      ['energía', 'Battery'], ['energy', 'Battery'], ['puerta', 'DoorClosed'],
      ['door', 'DoorClosed'], ['persiana', 'Blinds'], ['blind', 'Blinds'],
      ['temperatura', 'Thermometer'], ['temperature', 'Thermometer'],
      ['solar', 'SolarPanel'], ['batería', 'Battery'], ['battery', 'Battery'],
    ]) {
      expect(searchDashboardIcons(term).map((entry) => entry.name)).toContain(icon);
    }
  });

  it('commits only an explicit icon choice from the catalog', () => {
    const onChange = jest.fn();
    searchDashboardIcons('cam');
    expect(onChange).not.toHaveBeenCalled();
    chooseDashboardIcon('Camera', onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Camera');
  });

  it('covers representative home, energy, security, media, garden and pool icons', () => {
    expect(DASHBOARD_ICON_CATALOG.length).toBeGreaterThanOrEqual(100);
    expect(DASHBOARD_ICON_CATALOG.length).toBeLessThanOrEqual(150);
    for (const name of ['Home', 'SolarPanel', 'Camera', 'Shield', 'Tv', 'Sprout', 'mdi:pool', 'Monitor']) {
      expect(isDashboardIconAvailable(name)).toBe(true);
    }
  });
});
