import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useUiLabels } from './uiLabels';
import { cn } from '../../lib/utils';
import { SearchableSelectPanel } from './searchableSelect/SearchableSelectPanel';
import {
  computeDropdownPosition,
  filterOptions,
  groupOptions,
  readViewportBox,
  type DropdownPosition,
  type SearchableSelectOption,
} from './searchableSelect/searchableSelectModel';

export type { SearchableSelectOption };

export interface SearchableSelectFieldProps extends Omit<ComponentPropsWithoutRef<'button'>, 'id' | 'value' | 'onChange' | 'title' | 'disabled' | 'className' | 'placeholder'> {
  id?: string;
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  loading?: boolean;
  size?: 'default' | 'small';
  fullWidth?: boolean;
  title?: string;
  placement?: 'auto' | 'down';
  className?: string;
}

/**
 * SearchableSelectField
 *
 * Canonical portal-based selector for every general option list. It always
 * exposes search so feature views never need a separate select implementation.
 */
export function SearchableSelectField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  helperText,
  loading = false,
  size = 'default',
  fullWidth = true,
  title,
  placement = 'auto',
  className,
  ...triggerProps
}: SearchableSelectFieldProps) {
  const labels = useUiLabels();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const popupId = useId();
  const listboxId = useId();
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const isOpen = dropdownPosition !== null;
  const resolvedPlaceholder = placeholder ?? labels.selectOption;

  const updateDropdownPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownPosition(computeDropdownPosition(rect, placement, readViewportBox()));
  }, [placement]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setDropdownPosition(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownPosition(null);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.visualViewport?.addEventListener('resize', updateDropdownPosition);
    window.visualViewport?.addEventListener('scroll', updateDropdownPosition);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.visualViewport?.removeEventListener('resize', updateDropdownPosition);
      window.visualViewport?.removeEventListener('scroll', updateDropdownPosition);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, updateDropdownPosition]);

  const filteredOptions = useMemo(() => filterOptions(options, query), [options, query]);
  const groups = useMemo(() => groupOptions(filteredOptions), [filteredOptions]);

  const closeDropdown = () => {
    setDropdownPosition(null);
    setQuery('');
  };

  const closeAndFocusTrigger = () => {
    closeDropdown();
    triggerRef.current?.focus();
  };

  const openDropdown = () => {
    updateDropdownPosition();
    // Auto-focusing the search input is a nice touch for mouse/keyboard users
    // (type immediately to filter), but on touch devices it pops the virtual
    // keyboard on top of the option list the user just tapped to see. Only
    // devices with a fine pointer (mouse/trackpad) get the auto-focus.
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  };

  const handleToggle = () => {
    if (disabled || loading) return;
    if (isOpen) {
      closeDropdown();
      return;
    }
    openDropdown();
  };

  const dropdown = isOpen && dropdownPosition && typeof document !== 'undefined'
    ? createPortal(
        <SearchableSelectPanel
          popupId={popupId}
          listboxId={listboxId}
          ariaLabel={label ?? resolvedPlaceholder}
          position={dropdownPosition}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={labels.search}
          noResultsLabel={labels.noResults}
          filteredOptions={filteredOptions}
          groups={groups}
          value={value}
          onSelect={(nextValue) => {
            onChange(nextValue);
            closeAndFocusTrigger();
          }}
          onEscape={closeAndFocusTrigger}
          panelRef={dropdownRef}
          searchInputRef={searchInputRef}
          optionRefs={optionRefs}
        />,
        document.body,
      )
    : null;

  return (
    <div className={cn('min-w-0 space-y-2', !fullWidth && 'w-auto', className)}>
      {label ? (
        <label htmlFor={id} className="hp-field-label">
          {label}{required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <button
        {...triggerProps}
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        title={title ?? selected?.label}
        aria-haspopup="dialog"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        onClick={handleToggle}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
          }

          event.preventDefault();
          openDropdown();
        }}
        className={cn(
          'flex min-w-0 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 text-left text-body font-semibold text-foreground outline-none transition',
          size === 'small' ? 'h-9 text-caption' : 'h-11',
          'hover:border-primary/45 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30',
          (disabled || loading) && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-muted-foreground')}>{selected?.label ?? resolvedPlaceholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180', loading && 'animate-pulse')} />
      </button>

      {helperText ? <p className="break-words text-label text-muted-foreground">{helperText}</p> : null}

      {dropdown}
    </div>
  );
}
