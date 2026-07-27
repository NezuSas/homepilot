import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToggleSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

const sizeStyles: Record<NonNullable<ToggleSwitchProps['size']>, string> = {
  sm: 'h-7 w-12',
  md: 'h-8 w-14',
};

const thumbStyles: Record<NonNullable<ToggleSwitchProps['size']>, string> = {
  sm: 'h-5 w-5 top-1',
  md: 'h-6 w-6 top-1',
};

/**
 * Accessible boolean control for configuration surfaces.
 * Business labels remain in the calling view; the primitive owns state and focus behavior.
 */
export const ToggleSwitch = React.forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  ({ checked, onCheckedChange, label, size = 'md', isLoading = false, className, disabled, onClick, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={isLoading || undefined}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled || isLoading}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onCheckedChange(!checked);
        }
      }}
      className={cn(
        'relative shrink-0 touch-manipulation rounded-full border control-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        checked ? 'border-primary/40 bg-primary/25' : 'border-border bg-muted/60',
        'disabled:pointer-events-none disabled:opacity-45',
        sizeStyles[size],
        className,
      )}
    >
      <span
        className={cn(
          'absolute grid place-items-center rounded-full bg-background shadow-sm surface-transition',
          thumbStyles[size],
          checked ? 'right-1 bg-primary' : 'left-1',
        )}
      >
        {isLoading && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin text-muted-foreground" />}
      </span>
    </button>
  ),
);
ToggleSwitch.displayName = 'ToggleSwitch';
