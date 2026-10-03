import { resizeCardGrid } from './cardGridResize';

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
});
