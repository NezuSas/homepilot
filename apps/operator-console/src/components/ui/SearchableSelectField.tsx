import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchableSelectFieldProps {
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

interface DropdownPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
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
}: SearchableSelectFieldProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const isOpen = dropdownPosition !== null;
  const resolvedPlaceholder = placeholder ?? t('common.select_option');

  const updateDropdownPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 16;
    const preferredMaxHeight = 288;
    const viewportWidth = window.innerWidth;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const opensUp = placement === 'auto' && spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableHeight = opensUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(140, Math.min(preferredMaxHeight, availableHeight - 8));
    const width = Math.min(rect.width, viewportWidth - viewportPadding * 2);
    const left = Math.min(Math.max(viewportPadding, rect.left), viewportWidth - width - viewportPadding);

    setDropdownPosition({
      left,
      top: opensUp ? Math.max(viewportPadding, rect.top - maxHeight - 8) : rect.bottom + 8,
      width,
      maxHeight,
    });
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
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, updateDropdownPosition]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => (
      option.label.toLocaleLowerCase().includes(normalizedQuery)
      || option.description?.toLocaleLowerCase().includes(normalizedQuery)
    ));
  }, [options, query]);

  const closeDropdown = () => {
    setDropdownPosition(null);
    setQuery('');
  };

  const handleToggle = () => {
    if (disabled || loading) return;
    if (isOpen) {
      closeDropdown();
      return;
    }
    updateDropdownPosition();
  };

  const dropdown = isOpen && dropdownPosition && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100000] min-w-0 overflow-hidden rounded-panel border border-border/60 bg-popover/95 p-1.5 shadow-depth-3 backdrop-blur-xl"
          style={{
            left: dropdownPosition.left,
            top: dropdownPosition.top,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
          }}
        >
          <div className="relative min-w-0 border-b border-border/50 p-1.5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('common.search')}
              className="h-9 min-w-0 w-full rounded-control bg-muted/50 py-2 pl-8 pr-3 text-caption font-medium text-foreground outline-none transition focus:ring-2 focus:ring-primary/35"
            />
          </div>

          <div id={listboxId} role="listbox" aria-label={label ?? resolvedPlaceholder} className="max-h-[inherit] overflow-y-auto p-1">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    closeDropdown();
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left transition',
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : 'text-foreground hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block truncate text-label text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            }) : (
              <p className="px-3 py-6 text-center text-caption text-muted-foreground">{t('common.no_results')}</p>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn('min-w-0 space-y-2', !fullWidth && 'w-auto', className)}>
      {label ? (
        <label htmlFor={id} className="block break-words text-caption font-black uppercase tracking-label text-muted-foreground">
          {label}{required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={handleToggle}
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
