import { CLOCK_GRID, getClockGridOptions, getClockMinimumLayout } from './clockRegistry';
import { getCardGridHeight, getCardGridWidth, pickCardGridSize, resizeCardGrid } from '../cardGridResize';

describe('Feature: Clock size contract (AC56)', () => {
  it('Scenario: Historical automatic clocks project to the measured default without mutation', () => {
    const saved = { columns: 'full' as const, rows: 'auto' as const };
    expect(getClockGridOptions(saved)).toMatchObject({ columns: 12, rows: 6 });
    expect(saved).toEqual({ columns: 'full', rows: 'auto' });
    expect(getClockGridOptions()).toMatchObject(CLOCK_GRID.default);
    expect(getCardGridWidth(300, 12)).toBe(300);
    expect(getCardGridHeight(6)).toBe(160);
  });
  it('Scenario: Contract clamps editor, pointer, keyboard and resize bounds', () => {
    const grid = getClockGridOptions();
    expect(pickCardGridSize(grid, -100, -100, 120, 80)).toMatchObject(CLOCK_GRID.min);
    expect(pickCardGridSize(grid, 1000, 1000, 120, 80)).toMatchObject(CLOCK_GRID.max);
    expect(resizeCardGrid(grid, -100, -100, 6)).toMatchObject(CLOCK_GRID.min);
    expect(resizeCardGrid(grid, 100, 100, 6)).toMatchObject(CLOCK_GRID.max);
    expect(getClockGridOptions({ columns: 1, rows: 1 })).toMatchObject(CLOCK_GRID.min);
    expect(getClockGridOptions({ columns: 99, rows: 99 })).toMatchObject(CLOCK_GRID.max);
    expect(getClockMinimumLayout()).toEqual({ w: CLOCK_GRID.min.columns, h: CLOCK_GRID.min.rows });
  });
  it('Scenario: Smaller candidates fail the measured 70px dial budget at 300px useful width', () => {
    const diameter = (columns: number, rows: number) => Math.min((300 + 8) * columns / 12 - 8 - 18, rows * 28 - 8 - 18);
    expect(diameter(3, 4)).toBeLessThan(70);
    expect(diameter(4, 3)).toBeLessThan(70);
    expect(diameter(CLOCK_GRID.min.columns, CLOCK_GRID.min.rows)).toBeGreaterThanOrEqual(70);
  });
});
