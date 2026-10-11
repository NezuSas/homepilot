export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

export interface SearchableSelectGroup {
  label: string;
  options: SearchableSelectOption[];
}

export interface DropdownPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export interface TriggerRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export interface ViewportBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const VIEWPORT_PADDING = 16;
const PREFERRED_MAX_HEIGHT = 288;

/** Places the dropdown below (or above, when `auto` and cramped) the trigger, clamped to the viewport. */
export function computeDropdownPosition(
  rect: TriggerRect,
  placement: 'auto' | 'down',
  viewport: ViewportBox,
): DropdownPosition {
  const viewportBottom = viewport.top + viewport.height;
  const spaceBelow = viewportBottom - rect.bottom - VIEWPORT_PADDING;
  const spaceAbove = rect.top - viewport.top - VIEWPORT_PADDING;
  const opensUp = placement === 'auto' && spaceBelow < 180 && spaceAbove > spaceBelow;
  const availableHeight = opensUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(0, Math.min(PREFERRED_MAX_HEIGHT, availableHeight - 8, viewport.height - VIEWPORT_PADDING * 2));
  const width = Math.min(rect.width, viewport.width - VIEWPORT_PADDING * 2);
  const left = Math.min(Math.max(viewport.left + VIEWPORT_PADDING, rect.left), viewport.left + viewport.width - width - VIEWPORT_PADDING);
  const preferredTop = opensUp ? rect.top - maxHeight - 8 : rect.bottom + 8;
  const top = Math.min(
    Math.max(viewport.top + VIEWPORT_PADDING, preferredTop),
    viewportBottom - maxHeight - VIEWPORT_PADDING,
  );

  return { left, top, width, maxHeight };
}

/** Reads the visual viewport, falling back to the layout window size. */
export function readViewportBox(): ViewportBox {
  const visualViewport = window.visualViewport;
  return {
    left: visualViewport?.offsetLeft ?? 0,
    top: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  };
}

/** Case-insensitive match against label, description and group. */
export function filterOptions(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((option) => (
    option.label.toLocaleLowerCase().includes(normalizedQuery)
    || option.description?.toLocaleLowerCase().includes(normalizedQuery)
    || option.group?.toLocaleLowerCase().includes(normalizedQuery)
  ));
}

/** Groups consecutive options that share the same group label. */
export function groupOptions(options: SearchableSelectOption[]): SearchableSelectGroup[] {
  const result: SearchableSelectGroup[] = [];
  for (const option of options) {
    const group = option.group ?? '';
    const previous = result[result.length - 1];
    if (previous?.label === group) previous.options.push(option);
    else result.push({ label: group, options: [option] });
  }
  return result;
}

/** Wraps an index into the list bounds; returns -1 for an empty list. */
export function wrapOptionIndex(index: number, length: number): number {
  if (length === 0) return -1;
  return (index + length) % length;
}

/** Target index for ArrowDown/ArrowUp/Home/End from the current option index, or null for other keys. */
export function resolveOptionNavigation(key: string, currentIndex: number, length: number): number | null {
  if (key === 'ArrowDown') return currentIndex + 1;
  if (key === 'ArrowUp') return currentIndex - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return null;
}
