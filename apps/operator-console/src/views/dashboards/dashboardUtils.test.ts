import type { DashboardWidget } from './types';
import {
  getDashboardSectionPlaceholderY,
  resolveDashboardSectionLayouts,
} from './dashboardUtils';

function createSection(id: string, cardCount: number): DashboardWidget {
  return {
    id,
    type: 'section',
    config: {
      layout: { x: 0, y: 2, w: 3, h: 2 },
      binding: { entityId: '', entityType: 'system' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { title: id, showTitle: true },
      extra: {
        cards: Array.from({ length: cardCount }, (_, index) => ({ id: `${id}-card-${index}` })),
      },
    },
  };
}

describe('dashboard section layout', () => {
  it('places the fifth section and add-section placeholder below the tallest first row', () => {
    const firstRow = Array.from({ length: 4 }, (_, index) => createSection(`section-${index}`, 3));
    const sections = [...firstRow, createSection('section-4', 0)];
    const layouts = resolveDashboardSectionLayouts(sections, true);

    expect(layouts.get('section-0')).toMatchObject({ y: 2, h: 7 });
    expect(layouts.get('section-4')).toMatchObject({ x: 0, y: 10, h: 4 });
    expect(getDashboardSectionPlaceholderY(layouts)).toBe(15);
  });
});
