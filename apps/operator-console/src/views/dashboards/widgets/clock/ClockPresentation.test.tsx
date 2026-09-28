import { renderToStaticMarkup } from 'react-dom/server';
import type { DashboardWidgetConfig } from '../../types';
import { getClockCopy } from './clockUtils';
import { normalizeClockStyle, CLOCK_DESIGN_COMPONENTS } from './clockRegistry';

const now = new Date('2026-09-28T11:51:00');
const props = {
  now,
  config: {} as DashboardWidgetConfig,
  locale: 'es-EC',
  copy: getClockCopy('es-EC'),
  weather: { temperature: 19, code: 3, updatedAt: now.toISOString(), location: 'Cuenca', label: 'Nublado' },
  weatherStatus: 'ready' as const,
};

describe('Dashboard clock hierarchy', () => {
  it('keeps the default digital-first with one prominent time and secondary date/weather', () => {
    expect(normalizeClockStyle(undefined)).toBe('minimal');
    const Design = CLOCK_DESIGN_COMPONENTS[normalizeClockStyle(undefined)];
    const html = renderToStaticMarkup(<Design {...props} />);
    expect(html).toContain('11');
    expect(html).toContain('51');
    expect(html).toContain('SEP');
    expect(html).toContain('28');
    expect(html).toContain('Cuenca');
    expect(html).toContain('19');
    expect(html).toContain('text-clock-time-xl-fluid');
    expect(html).not.toContain('hpDialFace');
  });

  it('retains optional analog variants without a second oversized digital time', () => {
    for (const style of ['analog-classic', 'analog-minimal'] as const) {
      const Design = CLOCK_DESIGN_COMPONENTS[style];
      const html = renderToStaticMarkup(<Design {...props} />);
      expect(html).toContain('<svg');
      expect(html).toContain('11:51');
      expect(html).not.toContain('text-clock-analog-time-fluid');
      expect(html).not.toContain('text-clock-minimal-time-fluid');
    }
  });
});
