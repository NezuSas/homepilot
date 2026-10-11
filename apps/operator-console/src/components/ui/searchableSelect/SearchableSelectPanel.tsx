import type { MutableRefObject, RefObject } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  resolveOptionNavigation,
  wrapOptionIndex,
  type DropdownPosition,
  type SearchableSelectGroup,
  type SearchableSelectOption,
} from './searchableSelectModel';

interface SearchableSelectPanelProps {
  popupId: string;
  listboxId: string;
  ariaLabel: string;
  position: DropdownPosition;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  noResultsLabel: string;
  filteredOptions: SearchableSelectOption[];
  groups: SearchableSelectGroup[];
  value: string;
  onSelect: (value: string) => void;
  onEscape: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  optionRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
}

/** Floating panel of SearchableSelectField: search box plus the grouped option list. */
export function SearchableSelectPanel({
  popupId,
  listboxId,
  ariaLabel,
  position,
  query,
  onQueryChange,
  searchPlaceholder,
  noResultsLabel,
  filteredOptions,
  groups,
  value,
  onSelect,
  onEscape,
  panelRef,
  searchInputRef,
  optionRefs,
}: SearchableSelectPanelProps) {
  const focusOption = (index: number) => {
    const normalizedIndex = wrapOptionIndex(index, filteredOptions.length);
    if (normalizedIndex < 0) return;

    optionRefs.current.get(filteredOptions[normalizedIndex].value)?.focus();
  };

  return (
    <div
      ref={panelRef}
      id={popupId}
      role="dialog"
      aria-label={ariaLabel}
      className="fixed z-[100000] flex min-w-0 flex-col overflow-hidden rounded-panel border border-border/60 bg-popover/95 p-1.5 shadow-depth-3 backdrop-blur-xl"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
    >
      <div className="relative min-w-0 border-b border-border/50 p-1.5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusOption(0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusOption(filteredOptions.length - 1);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onEscape();
            }
          }}
          placeholder={searchPlaceholder}
          className="h-9 min-w-0 w-full rounded-control bg-muted/50 py-2 pl-8 pr-3 text-caption font-medium text-foreground outline-none transition focus:ring-2 focus:ring-primary/35"
        />
      </div>

      <div id={listboxId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        {filteredOptions.length > 0 ? groups.map((group, index) => <div key={`${group.label}:${index}`} role={group.label ? 'group' : undefined} aria-label={group.label || undefined}>
          {group.label && <p className="px-3 pb-1 pt-3 text-caption font-semibold text-muted-foreground">{group.label}</p>}
          {group.options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                ref={(element) => {
                  if (element) {
                    optionRefs.current.set(option.value, element);
                  } else {
                    optionRefs.current.delete(option.value);
                  }
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(option.value)}
                onKeyDown={(event) => {
                  const optionIndex = filteredOptions.findIndex((candidate) => candidate.value === option.value);
                  const nextIndex = resolveOptionNavigation(event.key, optionIndex, filteredOptions.length);

                  if (nextIndex !== null) {
                    event.preventDefault();
                    focusOption(nextIndex);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    onEscape();
                  }
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left transition',
                  isSelected
                    ? 'bg-primary/15 text-primary'
                    : 'text-foreground hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                )}
              >
                <span className="min-w-0">
                  <span className="block break-words text-body font-semibold leading-snug">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block break-words text-label leading-snug text-muted-foreground">{option.description}</span>
                  ) : null}
                </span>
                {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}</div>) : (
          <p className="px-3 py-6 text-center text-caption text-muted-foreground">{noResultsLabel}</p>
        )}
      </div>
    </div>
  );
}
