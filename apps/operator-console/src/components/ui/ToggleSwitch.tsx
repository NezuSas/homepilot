import React from 'react';
import { cn } from '../../lib/utils';

export interface ToggleSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  size?: 'sm' | 'md';
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
  ({ checked, onCheckedChange, label, size = 'md', className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative shrink-0 touch-manipulation rounded-full border control-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        checked ? 'border-primary/40 bg-primary/25' : 'border-border bg-muted/60',
        'disabled:pointer-events-none disabled:opacity-45',
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'absolute rounded-full bg-background shadow-sm surface-transition',
          thumbStyles[size],
          checked ? 'right-1 bg-primary' : 'left-1',
        )}
      />
    </button>
  ),
);
ToggleSwitch.displayName = 'ToggleSwitch';
