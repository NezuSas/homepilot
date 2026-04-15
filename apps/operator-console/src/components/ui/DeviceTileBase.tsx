import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface DeviceTileBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  disabled?: boolean;
  error?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
}

export const DeviceTileBase = React.forwardRef<HTMLDivElement, DeviceTileBaseProps>(
  ({ className, active = false, disabled = false, error = false, icon: Icon, iconClassName, title, subtitle, badge, rightAction, children, onClick, ...props }, ref) => {
    
    // Interacción controlada por click en el root
    const isInteractive = !!onClick && !disabled;

    return (
      <div
        ref={ref}
        onClick={isInteractive ? onClick : undefined}
        className={cn(
          "relative p-5 rounded-[2rem] border transition-all duration-500 overflow-hidden group flex flex-col justify-between",
          isInteractive ? "cursor-pointer hover:-translate-y-1 hover:shadow-xl" : "",
          disabled ? "opacity-50 grayscale select-none" : "",
          
          // Estilos base vs active
          active 
            ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5" 
            : "border-border bg-card",
            
          // Error overrides
          error && "border-danger/40 bg-danger/5 shadow-danger/5",
          
          isInteractive && !active && !error && "hover:border-primary/30",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
                "p-3 rounded-2xl transition-all duration-300",
                active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground",
                error ? "bg-danger text-danger-foreground shadow-lg shadow-danger/30" : ""
            )}>
              <Icon className={cn("w-5 h-5", iconClassName)} />
            </div>
            {badge && (
               <div>{badge}</div>
            )}
          </div>
          {rightAction && (
              <div 
                  className="z-10" 
                  onClick={(e) => { 
                      // Prevent trigger tile click when clicking action
                      if (isInteractive) e.stopPropagation(); 
                  }}
              >
                  {rightAction}
              </div>
          )}
        </div>
        
        {children && <div className="mb-4 flex-1">{children}</div>}

        <div className="mt-auto">
          <h3 className={cn(
              "font-bold text-base tracking-tight mb-0.5",
              error ? "text-danger" : "text-foreground"
          )}>
              {title}
          </h3>
          {subtitle && <p className="text-xs font-medium text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
    );
  }
);
DeviceTileBase.displayName = 'DeviceTileBase';
