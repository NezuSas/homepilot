import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  action?: React.ReactNode;
  /**
   * 'view'  — top-level page header (h1-scale, larger spacing)
   * 'section' — within-page section header (h2-scale, default)
   * 'group'  — small label for grouped lists
   */
  level?: 'view' | 'section' | 'group';
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, subtitle, icon: Icon, iconClassName, action, level = 'section', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'surface-transition flex flex-col sm:flex-row sm:items-center justify-between gap-4',
          level === 'view'    && 'mb-8 rounded-panel border border-border/50 bg-card/35 p-5 shadow-depth-1 backdrop-blur-md',
          level === 'section' && 'mb-6',
          level === 'group'   && 'mb-3',
          className
        )}
        {...props}
      >
        <div className="flex flex-col">
          {/* Eyebrow — only for section level with subtitle */}
          {subtitle && level !== 'group' && (
            <span className="text-label font-black uppercase tracking-[0.22em] text-muted-foreground/60 mb-1.5">
              {subtitle}
            </span>
          )}

          {/* Heading */}
          <div className={cn('flex items-center gap-2.5', level === 'group' ? 'gap-2' : '')}>
            {Icon && (
              <span
                className={cn(
                  'surface-transition flex shrink-0 items-center justify-center rounded-lg',
                  level === 'view'    && 'h-11 w-11 rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-depth-1',
                  level === 'section' && 'p-1 bg-muted text-muted-foreground',
                  level === 'group'   && 'text-muted-foreground/50',
                  iconClassName
                )}
              >
                <Icon
                  className={cn(
                    level === 'view'    && 'w-5 h-5',
                    level === 'section' && 'w-4 h-4',
                    level === 'group'   && 'w-3 h-3'
                  )}
                />
              </span>
            )}

            {level === 'view' ? (
              <h2 className="text-view-title font-black tracking-tighter luxury-text-gradient">
                {title}
              </h2>
            ) : level === 'section' ? (
              <h3 className="text-section-title font-bold tracking-tight text-foreground/85">
                {title}
              </h3>
            ) : (
              <span className="text-label font-black uppercase tracking-[0.2em] text-muted-foreground/55">
                {title}
              </span>
            )}
          </div>

          {/* Subtitle — inline for group level */}
          {subtitle && level === 'group' && (
            <span className="text-caption font-medium text-muted-foreground/60 mt-0.5 ml-5">
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
