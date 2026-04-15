import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  action?: React.ReactNode;
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, subtitle, icon: Icon, iconClassName, action, ...props }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", className)} 
        {...props}
      >
        <div className="flex flex-col">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
            {Icon && <Icon className={cn("w-5 h-5 text-primary", iconClassName)} />}
            {title}
          </h2>
          {subtitle && (
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              {subtitle}
            </span>
          )}
        </div>
        {action && (
          <div className="flex shrink-0">
            {action}
          </div>
        )}
      </div>
    );
  }
);
SectionHeader.displayName = 'SectionHeader';
