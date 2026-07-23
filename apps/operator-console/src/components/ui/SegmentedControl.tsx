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
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  optionClassName,
  tone = 'neutral',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-wrap items-stretch gap-1.5 rounded-panel border p-1.5',
        tone === 'primary'
          ? 'border-primary/10 bg-primary/[0.05]'
          : 'border-border/50 bg-muted/40',
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'flex min-h-10 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-control px-2 py-2 text-micro font-semibold uppercase leading-tight tracking-control transition-all',
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
            <span className="min-w-0 whitespace-normal break-words text-center">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
