import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: 'default' | 'ghost' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<NonNullable<IconButtonProps['variant']>, string> = {
  default: 'bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted hover:text-foreground',
  ghost: 'bg-transparent text-muted-foreground border border-transparent hover:bg-muted/60 hover:text-foreground',
  primary: 'bg-primary text-primary-foreground border border-transparent hover:bg-primary/90 shadow-sm shadow-primary/20',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
};

const sizeStyles: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, variant = 'default', size = 'md', className, disabled, title, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={title || label}
      disabled={disabled}
      className={cn(
        'control-transition interactive-lift inline-flex shrink-0 items-center justify-center rounded-control',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-45 disabled:translate-y-0 disabled:scale-100',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
);
IconButton.displayName = 'IconButton';
