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
          'control-transition group relative flex w-full min-w-0 items-center justify-between rounded-control border border-transparent',
          nested ? 'px-2 py-1.5' : 'px-3 py-2',
          // Active state uses the shared sidebar surface treatment.
          active
            ? 'sidebar-item-active text-muted-foreground'
            : 'text-muted-foreground hover:border-border/60 hover:bg-muted/70 hover:text-foreground',
          // Disabled
          isDisabled
            ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : 'interactive-lift cursor-pointer',
          // Duration
          collapsedOnDesktop && 'xl:h-11 xl:flex-none xl:justify-center xl:px-2 xl:py-2',
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
                ? 'bg-primary text-primary-foreground shadow-depth-1'
                : 'text-muted-foreground/70 group-hover:text-foreground'
            )}
          >
            <Icon className={nested ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </span>

          {/* Label */}
          <span
            className={cn(
              'min-w-0 flex-1 break-words text-left text-micro leading-tight transition-[opacity,width,margin] duration-base',
              // Navigation hierarchy is communicated by indentation and icon size,
              // never by a different text scale.
              'font-normal text-muted-foreground',
              collapsedOnDesktop && 'xl:hidden'
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
