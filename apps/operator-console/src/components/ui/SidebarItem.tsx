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
  collapsedOnDesktop?: boolean;
}

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, active = false, icon: Icon, label, soonText, badge, nested = false, collapsedOnDesktop = false, disabled, ...props }, ref) => {
    const isDisabled = disabled || !!soonText;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          'control-transition relative flex w-full min-w-0 items-center justify-between rounded-xl group',
          nested ? 'px-2 py-1.5' : 'px-3 py-2',
          // Active state (uses sidebar-item-active from index.css for the left bar)
          active
            ? 'sidebar-item-active text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          // Disabled
          isDisabled
            ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : 'interactive-lift cursor-pointer',
          // Duration
          collapsedOnDesktop && 'xl:justify-center xl:px-2',
          className
        )}
        {...props}
        title={collapsedOnDesktop ? label : props.title}
        aria-current={active ? 'page' : undefined}
      >
        <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", collapsedOnDesktop && "xl:justify-center")}>
          {/* Icon container */}
          <span
            className={cn(
              'surface-transition flex items-center justify-center rounded-lg shrink-0',
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
              'min-w-0 flex-1 break-words text-left text-caption leading-tight transition-[opacity,width,margin] duration-base',
              // Navigation hierarchy is communicated by indentation and icon size,
              // never by a different text scale.
              active ? 'font-semibold text-primary' : 'font-medium',
              collapsedOnDesktop && 'xl:w-0 xl:flex-none xl:opacity-0 xl:ml-0 xl:overflow-hidden'
            )}
          >
            {label}
          </span>
        </div>

        {/* Right side: badge or soon tag */}
        <div className={cn("flex items-center gap-1.5 shrink-0 surface-transition", collapsedOnDesktop && "xl:hidden")}>
          {badge && <div className="shrink-0">{badge}</div>}

          {soonText && (
            <span className="text-nano font-black uppercase tracking-widest text-primary/50 px-1.5 py-0.5 bg-primary/5 rounded border border-primary/10">
              {soonText}
            </span>
          )}
        </div>
      </button>
    );
  }
);
SidebarItem.displayName = 'SidebarItem';
