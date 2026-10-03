import { readCanvasSections, projectCanvasSections } from './dashboardSectionsAdapter';
import { createDefaultWidgetConfig } from './dashboardMutations';
import type { DashboardWidget } from './types';

describe('Feature: Sections runtime compatibility (AC46–AC48)', () => {
  it('Scenario: Canvas reads first-class sections without rewriting legacy responsive widths', () => {
    const config = createDefaultWidgetConfig('section', undefined, { titleArea: '', newSection: '', titlePlaceholder: '', subtitlePlaceholder: '' });
    const widgets: DashboardWidget[] = [{ id: 'section', type: 'section', config: { ...config, extra: { cards: [
      { id: 'old', kind: 'light', span: 'small', order: 17, bindingMetadata: { keep: true } },
      { id: 'sized', kind: 'sensor', gridOptions: { columns: 5, rows: 8 }, sensorScale: { min: 0, max: 100 } },
    ] } } }];
    const snapshot = JSON.stringify(widgets);
    const model = readCanvasSections(widgets, 'tab');
    expect(model.widgets).toEqual([]);
    expect(model.sections[0].cards.map(card => card.gridOptions.columns)).toEqual([3, 5]);
    const rendered = projectCanvasSections(widgets, model);
    expect(rendered[0].config.extra?.cards).toEqual([
      { id: 'old', kind: 'light', span: 'small', bindingMetadata: { keep: true } },
      { id: 'sized', kind: 'sensor', span: 'medium', gridOptions: { columns: 5, rows: 8 }, sensorScale: { min: 0, max: 100 } },
    ]);
    expect(JSON.stringify(widgets)).toBe(snapshot);
  });
});
