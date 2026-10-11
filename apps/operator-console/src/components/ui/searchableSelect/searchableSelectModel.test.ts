import {
  computeDropdownPosition,
  filterOptions,
  groupOptions,
  resolveOptionNavigation,
  wrapOptionIndex,
  type SearchableSelectOption,
} from './searchableSelectModel';

const viewport = { left: 0, top: 0, width: 800, height: 600 };
const options: SearchableSelectOption[] = [
  { value: 'a', label: 'Alpha', group: 'Letters' },
  { value: 'b', label: 'Beta', description: 'Second', group: 'Letters' },
  { value: '1', label: 'One' },
];

describe('SearchableSelect dropdown positioning', () => {
  it('opens below the trigger when there is room', () => {
    const position = computeDropdownPosition({ left: 100, top: 100, bottom: 140, width: 200 }, 'auto', viewport);
    expect(position).toEqual({ left: 100, top: 148, width: 200, maxHeight: 288 });
  });

  it('opens above in auto placement when space below is cramped', () => {
    const position = computeDropdownPosition({ left: 100, top: 500, bottom: 540, width: 200 }, 'auto', viewport);
    expect(position.top).toBeLessThan(500);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(500);
  });

  it('keeps opening down when placement is down', () => {
    const position = computeDropdownPosition({ left: 100, top: 500, bottom: 540, width: 200 }, 'down', viewport);
    expect(position).toEqual({ left: 100, top: 548, width: 200, maxHeight: 36 });
  });

  it('clamps width and left to the viewport', () => {
    const position = computeDropdownPosition({ left: 700, top: 10, bottom: 50, width: 900 }, 'auto', viewport);
    expect(position.width).toBe(768);
    expect(position.left).toBe(16);
  });
});

describe('SearchableSelect option model', () => {
  it('filters by label, description and group', () => {
    expect(filterOptions(options, '  ')).toBe(options);
    expect(filterOptions(options, 'alp').map((option) => option.value)).toEqual(['a']);
    expect(filterOptions(options, 'second').map((option) => option.value)).toEqual(['b']);
    expect(filterOptions(options, 'letters').map((option) => option.value)).toEqual(['a', 'b']);
    expect(filterOptions(options, 'zzz')).toEqual([]);
  });

  it('groups consecutive options by group label', () => {
    const groups = groupOptions(options);
    expect(groups.map((group) => [group.label, group.options.length])).toEqual([['Letters', 2], ['', 1]]);
  });

  it('wraps indexes and resolves keyboard navigation', () => {
    expect(wrapOptionIndex(-1, 3)).toBe(2);
    expect(wrapOptionIndex(3, 3)).toBe(0);
    expect(wrapOptionIndex(1, 0)).toBe(-1);
    expect(resolveOptionNavigation('ArrowDown', 1, 3)).toBe(2);
    expect(resolveOptionNavigation('ArrowUp', 1, 3)).toBe(0);
    expect(resolveOptionNavigation('Home', 2, 3)).toBe(0);
    expect(resolveOptionNavigation('End', 0, 3)).toBe(2);
    expect(resolveOptionNavigation('Enter', 0, 3)).toBeNull();
  });
});
