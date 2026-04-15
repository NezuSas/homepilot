import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const variantStyles = {
  primary:
    'bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] hover:bg-primary/90 active:scale-95 shadow-lg border border-transparent',
  secondary:
    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:scale-[1.02] active:scale-95 border border-transparent',
  outline:
    'bg-background border border-border text-foreground hover:bg-muted active:scale-95 shadow-sm',
  ghost:
    'bg-transparent text-foreground hover:bg-muted/80 active:scale-95 border border-transparent',
  danger:
    'bg-danger text-danger-foreground shadow-danger/20 hover:scale-[1.02] hover:bg-danger/90 active:scale-95 shadow-lg border border-transparent',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-2xl',
  icon: 'p-2 rounded-xl flex items-center justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none disabled:grayscale-[0.5]',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
