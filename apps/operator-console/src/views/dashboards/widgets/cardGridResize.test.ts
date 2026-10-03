import { fitCardsToSectionWidth, getCardFrameClass, getCardGridHeight, getCardGridRowSpan, getCardGridWidth, getCardPresentationStyle, pickCardGridSize, resizeCardGrid } from './cardGridResize';

describe('Feature: Twelve-column card resizing (AC48)', () => {
  it('Scenario: New selections cannot create a one-by-one card, but historical sizes are not rewritten', () => {
    expect(pickCardGridSize({ columns: 6, rows: 'auto' }, 0, 0, 12, 8)).toMatchObject({ columns: 2, rows: 2 });
    expect(pickCardGridSize({ columns: 6, rows: 'auto', minColumns: 4, minRows: 3 }, 0, 0, 12, 8)).toMatchObject({ columns: 4, rows: 3 });
    const historical = { columns: 1 as const, rows: 1, maxColumns: 1 as const };
    expect(pickCardGridSize(historical, 12, 8, 12, 8)).toBe(historical);
    expect(getCardGridHeight(1)).toBe(20);
  });
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
    expect(resizeCardGrid({ columns: 6, rows: 5 }, 0, 100, 5).rows).toBe(8);
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
  it('Scenario: Mouse and touch coordinates select columns and rows directly with bounded growth', () => {
    expect(pickCardGridSize({ columns: 6, rows: 'auto' }, 100, 160, 240, 240)).toEqual({ columns: 5, rows: 6 });
    expect(pickCardGridSize({ columns: 6, rows: 'auto', minColumns: 3, maxColumns: 9, minRows: 2, maxRows: 8 }, -100, 1000, 240, 240)).toMatchObject({ columns: 3, rows: 8 });
    expect(pickCardGridSize({ columns: 6, rows: 4 }, 7, 5, 12, 8)).toMatchObject({ columns: 7, rows: 5 });
    const initial = { columns: 6 as const, rows: 'auto' as const };
    expect(pickCardGridSize(initial, 1, 1, 0, 0)).toBe(initial);
    expect(initial.rows).toBe('auto');
  });
  it('Scenario: Reducing and restoring section width preserves rows, binding, order and bounded card widths', () => {
    const cards = [{ id: 'a', entityId: 'lamp', gridOptions: { columns: 6, rows: 8 }, hidden: true }, { id: 'b', gridOptions: { columns: 'full', rows: 5 } }];
    const reduced = fitCardsToSectionWidth(cards, 2, 1);
    expect(reduced).toEqual([{ ...cards[0], gridOptions: { columns: 12, rows: 8 } }, cards[1]]);
    expect(fitCardsToSectionWidth(reduced, 1, 2)).toEqual(cards);
    expect(cards[0].gridOptions.columns).toBe(6);
    expect(fitCardsToSectionWidth(cards, 1, 1)).toBe(cards);
    expect(fitCardsToSectionWidth([{ id: 'legacy', span: 'small' }], 2, 1)).toEqual([{ id: 'legacy', span: 'small', gridOptions: { columns: 6, rows: 'auto' } }]);
  });
  it('Scenario: Content expands its section rows instead of being trapped in a fixed-height scroller', () => {
    expect(getCardGridRowSpan(6, 8)).toBe(8);
    expect(getCardGridRowSpan(8, 6)).toBe(8);
    expect(getCardGridRowSpan('auto', 2, 4)).toBe(4);
    expect(getCardGridRowSpan('auto', 8, 4)).toBe(8);
  });
  it('Scenario: Manual and automatic sizing share presentation without capping the instrument or shrinking controls', () => {
    expect(getCardPresentationStyle(4)).toEqual({ containerType: 'inline-size', minHeight: 104 });
    expect(getCardPresentationStyle(8)).toEqual({ containerType: 'inline-size', minHeight: 216 });
    expect(getCardPresentationStyle('auto')).toEqual({ containerType: 'inline-size', minHeight: undefined });
    for (const rows of [4, 8, 'auto'] as const) {
      expect(getCardPresentationStyle(rows).height).toBeUndefined();
      expect(getCardPresentationStyle(rows).maxHeight).toBeUndefined();
    }
    expect(pickCardGridSize({ columns: 6, rows: 20, maxRows: 20 }, 12, 20, 12, 8).rows).toBe(8);
    expect(getCardGridHeight(20)).toBe(552);
    expect(pickCardGridSize({ columns: 3, rows: 4, columnStart: 10, rowStart: 5 }, 12, 4, 12, 8)).toMatchObject({ columns: 12, columnStart: 1, rowStart: 5 });
  });
});
