import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface DashboardSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface DashboardSelectProps {
  label?: string;
  value: string;
  options: DashboardSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  placement?: 'auto' | 'down';
}

export function DashboardSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccionar',
  disabled = false,
  className,
  placement = 'auto',
}: DashboardSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  const selected = options.find((option) => option.value === value);

  const computeDropdownPos = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 16;
    const preferredMaxHeight = 288;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const opensUp = placement === 'auto' && spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(preferredMaxHeight, opensUp ? spaceAbove - 8 : spaceBelow - 8));

    setDropdownPos({
      left: rect.left,
      top: opensUp ? rect.top - maxHeight - 8 : rect.bottom + 8,
      width: rect.width,
      maxHeight,
    });
  };

  const isOpen = Boolean(dropdownPos);

  useEffect(() => {
    if (!dropdownPos) return;

    const close = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return;
      setDropdownPos(null);
    };

    const reposition = () => computeDropdownPos();

    window.addEventListener('mousedown', close);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [dropdownPos]);

  const dropdown = isOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed z-[100000] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1.5 shadow-2xl"
          style={{
            left: dropdownPos?.left,
            top: dropdownPos?.top,
            width: dropdownPos?.width,
            maxHeight: dropdownPos?.maxHeight,
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => {
                  onChange(option.value);
                  setDropdownPos(null);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition',
                  active ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>

                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (dropdownPos) {
            setDropdownPos(null);
          } else {
            computeDropdownPos();
          }
        }}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left text-sm font-semibold text-foreground outline-none transition',
          'hover:border-primary/45 focus:border-primary/60',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', dropdownPos && 'rotate-180')} />
      </button>

      {dropdown}
    </div>
  );
}
