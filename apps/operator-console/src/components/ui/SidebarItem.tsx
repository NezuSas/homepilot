import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  soonText?: string;
  badge?: React.ReactNode;
  nested?: boolean;
}

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, active = false, icon: Icon, label, soonText, badge, nested = false, disabled, ...props }, ref) => {
    const isDisabled = disabled || !!soonText;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          'relative w-full flex items-center justify-between rounded-xl group transition-all',
          nested ? 'py-1.5 px-2' : 'py-2 px-3',
          // Active state (uses sidebar-item-active from index.css for the left bar)
          active
            ? 'sidebar-item-active text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          // Disabled
          isDisabled
            ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : 'cursor-pointer active:scale-[0.98]',
          // Duration
          'duration-150',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon container */}
          <span
            className={cn(
              'flex items-center justify-center rounded-lg transition-all duration-150',
              nested ? 'w-6 h-6' : 'w-7 h-7',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground/70 group-hover:text-foreground'
            )}
          >
            <Icon className={nested ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </span>

          {/* Label */}
          <span
            className={cn(
              'tracking-tight text-left leading-none',
              nested ? 'text-[0.76rem]' : 'text-[0.82rem]',
              active ? 'font-bold text-primary' : 'font-medium'
            )}
          >
            {label}
          </span>
        </div>

        {/* Right side: badge or soon tag */}
        <div className="flex items-center gap-1.5 shrink-0">
          {badge && <div className="shrink-0">{badge}</div>}

          {soonText && (
            <span className="text-[8px] font-black uppercase tracking-widest text-primary/50 px-1.5 py-0.5 bg-primary/5 rounded border border-primary/10">
              {soonText}
            </span>
          )}
        </div>
      </button>
    );
  }
);
SidebarItem.displayName = 'SidebarItem';
