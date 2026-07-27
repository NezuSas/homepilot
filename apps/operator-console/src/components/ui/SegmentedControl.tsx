import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  optionClassName?: string;
  tone?: 'neutral' | 'primary';
  /**
   * Keeps long exclusive-choice labels on a single line while allowing the
   * control itself to scroll inside its own bounds. Use for navigation tabs,
   * where truncating a destination name would hide essential context.
   */
  layout?: 'wrap' | 'scroll';
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  optionClassName,
  tone = 'neutral',
  layout = 'wrap',
}: SegmentedControlProps<T>) {
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (currentIndex: number, direction: 1 | -1) => {
    if (options.length === 0) return;

    let nextIndex = currentIndex;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const candidate = (currentIndex + direction * offset + options.length) % options.length;
      if (!options[candidate].disabled) {
        nextIndex = candidate;
        break;
      }
    }

    const nextOption = options[nextIndex];
    if (!nextOption || nextOption.disabled) return;

    onChange(nextOption.value);
    optionRefs.current[nextIndex]?.focus();
  };

  const focusEdge = (fromEnd: boolean) => {
    const orderedIndexes = options.map((_, index) => index);
    if (fromEnd) orderedIndexes.reverse();

    const nextIndex = orderedIndexes.find((index) => !options[index].disabled);
    if (nextIndex === undefined) return;

    onChange(options[nextIndex].value);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex min-w-0 items-stretch gap-1.5 rounded-panel border p-1.5',
        layout === 'scroll'
          ? 'flex-nowrap overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex-wrap',
        tone === 'primary'
          ? 'border-primary/10 bg-primary/[0.05]'
          : 'border-border/50 bg-muted/40',
        className
      )}
    >
      {options.map((option, optionIndex) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            key={option.value}
            ref={(element) => {
              optionRefs.current[optionIndex] = element;
            }}
            type="button"
            role="radio"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveFocus(optionIndex, 1);
              }

              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveFocus(optionIndex, -1);
              }

              if (event.key === 'Home') {
                event.preventDefault();
                focusEdge(false);
              }

              if (event.key === 'End') {
                event.preventDefault();
                focusEdge(true);
              }
            }}
            className={cn(
              'flex min-h-10 min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-control px-2 py-2 text-micro font-semibold uppercase leading-tight tracking-control transition-all',
              layout === 'scroll' ? 'flex-none' : 'flex-1',
              active
                ? tone === 'primary'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-background text-primary shadow-sm border border-border'
                : tone === 'primary'
                  ? 'text-primary/45 hover:bg-primary/10 hover:text-primary'
                  : 'text-muted-foreground hover:bg-background/30 hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-40',
              optionClassName
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span
              className={cn(
                'min-w-0 text-center',
                layout === 'scroll' ? 'whitespace-nowrap' : 'whitespace-normal break-words'
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
