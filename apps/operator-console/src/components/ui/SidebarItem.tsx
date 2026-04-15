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
    
    // Si tiene soonText, asumimos que está deshabilitado a menos que se especifique lo contrario
    const isDisabled = disabled || !!soonText;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-2xl group transition-all duration-300",
          nested ? "pl-0 py-2" : "",
          active 
            ? "bg-primary/10 text-primary shadow-inner shadow-primary/20" 
            : "text-muted-foreground hover:bg-card hover:-translate-y-[1px] hover:shadow-sm",
          isDisabled ? "opacity-60 cursor-not-allowed hover:bg-transparent hover:translate-y-0" : "cursor-pointer active:scale-95",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3">
          <span 
            className={cn(
              "p-2 rounded-xl transition-all duration-300",
              nested ? "p-1.5" : "",
              active 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40" 
                : "bg-muted group-hover:bg-background group-hover:shadow text-muted-foreground",
              isDisabled && !active && "bg-muted text-muted-foreground opacity-50"
            )}
          >
            <Icon className={cn("w-4 h-4", nested ? "w-3.5 h-3.5" : "")} />
          </span>
          <span className={cn(
             "font-bold tracking-tight text-left",
             nested ? "text-xs" : "text-sm",
             active ? "text-primary" : "text-foreground"
          )}>
            {label}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
            {badge && (
                <div className="flex shrink-0">
                    {badge}
                </div>
            )}
            
            {soonText && (
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 py-0.5 bg-primary/5 rounded border border-primary/10">
                    {soonText}
                </span>
            )}
        </div>
      </button>
    );
  }
);
SidebarItem.displayName = 'SidebarItem';
