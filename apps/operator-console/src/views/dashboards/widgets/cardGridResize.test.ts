import { getCardFrameClass, getCardGridHeight, getCardGridWidth, resizeCardGrid } from './cardGridResize';

describe('Feature: Twelve-column card resizing (AC48)', () => {
  it('Scenario: Quantized width and height honor limits without changing their source', () => {
    const initial = { columns: 6 as const, rows: 'auto' as const, minColumns: 3 as const, maxColumns: 9 as const, minRows: 2, maxRows: 10 };
    expect(resizeCardGrid(initial, 2, 0, 5)).toMatchObject({ columns: 8, rows: 'auto' });
    expect(resizeCardGrid(initial, 20, 20, 5)).toMatchObject({ columns: 9, rows: 10 });
    expect(resizeCardGrid(initial, -20, -20, 5)).toMatchObject({ columns: 3, rows: 2 });
    expect(initial).toMatchObject({ columns: 6, rows: 'auto' });
  });
  it('Scenario: Full width starts from twelve columns and manual rows remain stable', () => {
    expect(resizeCardGrid({ columns: 'full', rows: 4 }, -1, 0, 8)).toEqual({ columns: 11, rows: 4 });
  });
  it('Scenario: Editor preview uses the live twelve-track gap and masonry row dimensions', () => {
    expect(getCardGridWidth(400, 'full')).toBe(400);
    expect(getCardGridWidth(400, 6)).toBe(196);
    expect(getCardGridWidth(400, 3)).toBe(94);
    expect(getCardGridHeight(6)).toBe(160);
    expect(getCardGridHeight('auto')).toBeUndefined();
  });
  it('Scenario: Manual growth is bounded without changing historical values on load', () => {
    expect(resizeCardGrid({ columns: 6, rows: 5 }, 0, 100, 5).rows).toBe(12);
    expect(getCardGridHeight(20)).toBe(552);
    expect(resizeCardGrid({ columns: 6, rows: 5, maxRows: 8 }, 0, 100, 5).rows).toBe(8);
  });
  it('Scenario: Live surface and preview retain identical geometry in both light states', () => {
    const inactive = getCardFrameClass('light', 'small');
    const active = getCardFrameClass('light', 'small', true);
    for (const surface of [inactive, active]) {
      expect(surface).toContain('rounded-section');
      expect(surface).toContain('min-h-device-card-compact');
    }
    expect(getCardFrameClass('sensor', 'medium')).toContain('rounded-2xl');
  });
});
