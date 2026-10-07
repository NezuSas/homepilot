import { clockSweepPlan } from '../apps/operator-console/tests/clockSweepPlan';

describe('Feature: Bounded exhaustive clock sweep (AC56)', () => {
  it.each([[360, 270], [768, 53190], [1024, 87750], [1440, 143910]])(
    'Scenario: %i viewport retains all %i real-browser combinations without duplicate widths',
    (viewport, combinations) => {
      const { batches, maxUsefulWidth } = clockSweepPlan(viewport);
      const widths = batches.flat();
      expect(widths.length * 45 * 3).toBe(combinations);
      expect(new Set(widths).size).toBe(widths.length);
      expect(widths).toEqual(expect.arrayContaining([300, maxUsefulWidth, 4000]));
      for (let width = 300; width <= maxUsefulWidth; width++) expect(widths).toContain(width);
      expect(batches.every(batch => batch.length <= 50)).toBe(true);
    },
  );
  it.each([0, -1, NaN, 1.5])('Scenario: Invalid step %s cannot hang the sweep', step => {
    expect(() => clockSweepPlan(1440, step)).toThrow('positive integer');
  });
});
