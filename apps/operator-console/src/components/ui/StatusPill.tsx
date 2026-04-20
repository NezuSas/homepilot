import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'neutral' | 'offline';
  pulse?: boolean;
  /** Show as a compact dot-only pill (no text) */
  dot?: boolean;
}

const variantConfig: Record<
  NonNullable<StatusPillProps['variant']>,
  { pill: string; dot: string }
> = {
  success: {
    pill: 'bg-success/10 text-success border-success/20',
    dot: 'bg-success',
  },
  warning: {
    pill: 'bg-warning/10 text-warning border-warning/20',
    dot: 'bg-warning',
  },
  danger: {
    pill: 'bg-danger/10 text-danger border-danger/20',
    dot: 'bg-danger',
  },
  primary: {
    pill: 'bg-primary/10 text-primary border-primary/20',
    dot: 'bg-primary',
  },
  neutral: {
    pill: 'bg-muted/40 text-muted-foreground border-border/40',
    dot: 'bg-muted-foreground/40',
  },
  offline: {
    pill: 'bg-muted/20 text-muted-foreground/40 border-border/20',
    dot: 'bg-muted-foreground/25',
  },
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, variant = 'neutral', pulse = false, dot = false, children, ...props }, ref) => {
    const cfg = variantConfig[variant];

    if (dot) {
      return (
        <span ref={ref} className={cn('relative flex items-center justify-center', className)} {...props}>
          {pulse && (
            <span
              className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', cfg.dot)}
            />
          )}
          <span className={cn('relative inline-flex rounded-full w-2 h-2', cfg.dot)} />
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
          cfg.pill,
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                cfg.dot
              )}
            />
            <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', cfg.dot)} />
          </span>
        )}
        {children}
      </span>
    );
  }
);
StatusPill.displayName = 'StatusPill';
