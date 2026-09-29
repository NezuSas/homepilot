import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DashboardWidgetConfig } from '../../types';
import { getClockCopy } from './clockUtils';
import { normalizeClockStyle, CLOCK_DESIGN_COMPONENTS, CLOCK_STYLES } from './clockRegistry';

const now = new Date('2026-09-28T11:51:00');
const props = {
  now,
  config: {} as DashboardWidgetConfig,
  locale: 'es-EC',
  copy: getClockCopy('es-EC'),
  weather: { temperature: 19, code: 3, updatedAt: now.toISOString(), location: 'Cuenca', label: 'Nublado' },
  weatherStatus: 'ready' as const,
};

describe('HomePilot Clock', () => {
  it('offers one selectable clock while accepting all historical style IDs', () => {
    expect(CLOCK_STYLES.map((style) => style.value)).toEqual(['analog-classic']);
    for (const style of ['minimal', 'digital', 'analog-classic', 'analog-minimal'] as const) {
      expect(normalizeClockStyle(style)).toBe(style);
      expect(CLOCK_DESIGN_COMPONENTS[style]).toBe(CLOCK_DESIGN_COMPONENTS['analog-classic']);
    }
    expect(normalizeClockStyle('elegant')).toBe('minimal');
    expect(normalizeClockStyle('analog-orbit')).toBe('analog-classic');
  });

  it('renders the same premium composition, date, time and weather for every legacy ID', () => {
    const markup = (['minimal', 'digital', 'analog-classic', 'analog-minimal'] as const)
      .map((style) => renderToStaticMarkup(createElement(CLOCK_DESIGN_COMPONENTS[style], props)));
    expect(new Set(markup).size).toBe(1);
    expect(markup[0]).toContain('data-homepilot-clock');
    expect(markup[0]).toContain('hpDialFace-premium');
    expect(markup[0]).toContain('Reloj');
    expect(markup[0]).toContain('HOMEPILOT');
    expect(markup[0]).toContain('Lunes');
    expect(markup[0]).toContain('28 de Septiembre');
    expect(markup[0]).toContain('11:51');
    expect(markup[0]).toContain('Cuenca');
    expect(markup[0]).toContain('19');
    expect(markup[0]).toContain('Los grandes espacios');
    expect(markup[0]).toContain('empiezan con un buen control.');
  });
});
