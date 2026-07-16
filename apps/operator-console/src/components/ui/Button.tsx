import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-foreground border border-transparent ' +
    'hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 ' +
    'shadow-sm shadow-primary/20',
  secondary:
    'bg-muted/60 text-foreground border border-border/60 ' +
    'hover:bg-muted hover:border-border hover:shadow-sm',
  outline:
    'bg-transparent text-foreground border border-border ' +
    'hover:bg-muted/50 hover:border-border/80',
  ghost:
    'bg-transparent text-foreground border border-transparent ' +
    'hover:bg-muted/60',
  danger:
    'bg-danger text-danger-foreground border border-transparent ' +
    'hover:bg-danger/90 hover:shadow-lg hover:shadow-danger/20 ' +
    'shadow-sm shadow-danger/15',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  xs:   'min-h-7 px-2.5 py-1 text-caption rounded-lg gap-1.5',
  sm:   'min-h-9 px-3 py-1.5 text-caption rounded-control gap-1.5',
  md:   'min-h-10 px-4 py-2 text-body-compact rounded-control gap-2',
  lg:   'min-h-11 px-5 py-2.5 text-body-compact rounded-panel gap-2',
  icon: 'p-2 rounded-control flex items-center justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        // Base
        'control-transition interactive-lift inline-flex items-center justify-center font-semibold',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        // Disabled
        'disabled:opacity-45 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
