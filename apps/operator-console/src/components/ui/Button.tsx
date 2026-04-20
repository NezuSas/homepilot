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
    'hover:bg-primary/90 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25 ' +
    'active:translate-y-0 active:scale-[0.98] ' +
    'shadow-sm shadow-primary/20',
  secondary:
    'bg-muted/60 text-foreground border border-border/60 ' +
    'hover:bg-muted hover:border-border hover:-translate-y-px hover:shadow-sm ' +
    'active:translate-y-0 active:scale-[0.98]',
  outline:
    'bg-transparent text-foreground border border-border ' +
    'hover:bg-muted/50 hover:border-border/80 ' +
    'active:scale-[0.98]',
  ghost:
    'bg-transparent text-foreground border border-transparent ' +
    'hover:bg-muted/60 ' +
    'active:scale-[0.98]',
  danger:
    'bg-danger text-danger-foreground border border-transparent ' +
    'hover:bg-danger/90 hover:-translate-y-px hover:shadow-lg hover:shadow-danger/20 ' +
    'active:translate-y-0 active:scale-[0.98] ' +
    'shadow-sm shadow-danger/15',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  xs:   'px-2.5 py-1 text-[0.7rem] rounded-lg gap-1.5',
  sm:   'px-3 py-1.5 text-[0.76rem] rounded-xl gap-1.5',
  md:   'px-4 py-2 text-[0.82rem] rounded-xl gap-2',
  lg:   'px-5 py-2.5 text-sm rounded-2xl gap-2',
  icon: 'p-2 rounded-xl flex items-center justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        // Base
        'inline-flex items-center justify-center font-semibold transition-all duration-150',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        // Disabled
        'disabled:opacity-45 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none',
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
