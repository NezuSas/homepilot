import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface DeviceTileBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  disabled?: boolean;
  error?: boolean;
  syncing?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
}

export const DeviceTileBase = React.forwardRef<HTMLDivElement, DeviceTileBaseProps>(
  (
    {
      className,
      active = false,
      disabled = false,
      error = false,
      syncing = false,
      icon: Icon,
      iconClassName,
      title,
      subtitle,
      badge,
      rightAction,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isInteractive = !!onClick && !disabled;

    return (
      <div
        ref={ref}
        onClick={isInteractive ? onClick : undefined}
        className={cn(
          // Base structure
          'relative rounded-[1.75rem] border transition-all overflow-hidden group flex flex-col justify-between',
          // Padding — slightly more breathing room
          'p-5',
          // Cursor
          isInteractive ? 'cursor-pointer' : '',
          // Disabled state
          disabled ? 'opacity-40 grayscale pointer-events-none select-none' : '',
          // State-driven surfaces (from index.css utilities)
          error
            ? 'device-state-error'
            : active
              ? 'device-state-on'
              : 'device-state-off',
          // Interactive hover lift — only when not disabled and not applying via CSS
          isInteractive && !disabled ? 'hover:-translate-y-[2px] transition-transform duration-200' : '',
          className
        )}
        {...props}
      >
        {/* ON-state ambient light pulse — purely decorative */}
        {active && !error && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-[1.75rem] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, hsl(210 100% 58% / 0.07) 0%, transparent 65%)',
            }}
          />
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            {/* Icon container */}
            <div
              className={cn(
                'p-2.5 rounded-2xl transition-all duration-300 relative',
                active && !error
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : error
                    ? 'bg-danger/15 text-danger'
                    : syncing
                      ? 'bg-primary/10 text-primary/70'
                      : 'bg-muted/60 text-muted-foreground/60',
                iconClassName
              )}
            >
              <Icon
                className={cn(
                  'w-[1.1rem] h-[1.1rem]',
                  syncing && 'animate-pulse',
                )}
              />
              {/* Syncing ring */}
              {syncing && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl border border-primary/40 animate-ping opacity-50"
                />
              )}
            </div>

            {badge && <div>{badge}</div>}
          </div>

          {rightAction && (
            <div
              className="z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
            >
              {rightAction}
            </div>
          )}
        </div>

        {children && <div className="mb-3 flex-1 relative z-10">{children}</div>}

        {/* Label area */}
        <div className="mt-auto relative z-10">
          <h3
            className={cn(
              'font-bold text-[0.9rem] tracking-tight leading-snug',
              error
                ? 'text-danger'
                : active
                  ? 'text-foreground'
                  : 'text-foreground/60'
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                'text-[0.68rem] font-medium mt-0.5 truncate',
                active ? 'text-muted-foreground' : 'text-muted-foreground/40'
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Bottom ON indicator strip */}
        {active && !error && (
          <span
            aria-hidden
            className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-primary/50"
            style={{ boxShadow: '0 0 8px hsl(210 100% 58% / 0.6)' }}
          />
        )}
      </div>
    );
  }
);
DeviceTileBase.displayName = 'DeviceTileBase';
