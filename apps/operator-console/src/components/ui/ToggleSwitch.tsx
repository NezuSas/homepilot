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
      data-legacy-size={size}
      disabled={disabled || isLoading}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onCheckedChange(!checked);
        }
      }}
      className={cn(
        'homepilot-toggle-switch relative h-11 w-14 shrink-0 touch-manipulation rounded-control bg-transparent control-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('homepilot-toggle-track absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-full border', checked ? 'border-primary/40 bg-primary/25' : 'border-border bg-muted/60')}>
      <span
        className={cn(
          'homepilot-toggle-thumb absolute grid place-items-center rounded-full bg-background shadow-sm surface-transition',
          'h-6 w-6 top-1',
          checked ? 'right-1 bg-primary' : 'left-1',
        )}
      >
        {isLoading && <Loader2 aria-hidden="true" focusable="false" className="h-3 w-3 animate-spin text-muted-foreground motion-reduce:animate-none" />}
      </span>
      </span>
    </button>
  ),
);
ToggleSwitch.displayName = 'ToggleSwitch';
