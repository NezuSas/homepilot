import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
  pulse?: boolean;
}

const variantStyles = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  primary: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted/30 text-muted-foreground border-border/40',
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, variant = 'neutral', pulse = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', 
                variant === 'success' && 'bg-success',
                variant === 'warning' && 'bg-warning',
                variant === 'danger' && 'bg-danger',
                variant === 'primary' && 'bg-primary',
                variant === 'neutral' && 'bg-muted-foreground',
            )}></span>
            <span className={cn('relative inline-flex rounded-full h-2 w-2', 
                variant === 'success' && 'bg-success',
                variant === 'warning' && 'bg-warning',
                variant === 'danger' && 'bg-danger',
                variant === 'primary' && 'bg-primary',
                variant === 'neutral' && 'bg-muted-foreground',
            )}></span>
          </span>
        )}
        {children}
      </span>
    );
  }
);
StatusPill.displayName = 'StatusPill';
