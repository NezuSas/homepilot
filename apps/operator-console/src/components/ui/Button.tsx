import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
  /** Legacy text sizes are aliases for the single standard size. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    '!bg-[var(--button-primary)] !text-[var(--button-on-primary)] border border-transparent ' +
    'hover:!brightness-110 active:!brightness-95',
  secondary:
    '!bg-[var(--button-secondary)] !text-[var(--button-foreground)] border border-transparent ' +
    'hover:!brightness-110 active:!brightness-95',
  outline:
    '!bg-transparent !text-[var(--button-foreground)] border !border-[var(--button-outline)] ' +
    'hover:!bg-[var(--button-secondary)]',
  ghost:
    '!bg-transparent !text-[var(--button-foreground)] border border-transparent ' +
    'hover:!bg-[var(--button-secondary)]',
  danger:
    '!bg-[var(--button-danger)] !text-[var(--button-on-danger)] border border-transparent ' +
    'hover:!brightness-110 active:!brightness-95',
  warning:
    '!bg-warning !text-warning-foreground border border-transparent ' +
    'hover:!brightness-110 active:!brightness-95',
};

// Consumers control placement and width, not the design of an action button.
// Important utilities take precedence over historical responsive overrides.
const standardStyles =
  '!min-h-11 !h-auto !max-h-none !rounded-control !gap-2 ' +
  '!font-sans !text-body-compact !font-semibold !leading-5 !tracking-normal !normal-case ' +
  '!shadow-none hover:!shadow-none [&>svg]:!h-4 [&>svg]:!w-4 [&>svg]:!shrink-0';

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        // Base
        'homepilot-button control-transition inline-flex min-w-0 max-w-full touch-manipulation items-center justify-center break-words text-center',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        // Disabled
        'disabled:opacity-45 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:shadow-none',
        variantStyles[variant],
        className,
        standardStyles,
        size === 'icon' ? '!h-11 !w-11 !min-w-11 !shrink-0 !p-2.5' : '!px-4 !py-2.5'
      )}
      {...props}
    >
      {isLoading && <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin shrink-0 motion-reduce:animate-none" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
