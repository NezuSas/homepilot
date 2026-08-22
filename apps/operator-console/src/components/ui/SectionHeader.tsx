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
   * 'view' is a top-level page header, 'section' is an in-page heading,
   * and 'group' labels a compact collection.
   */
  level?: 'view' | 'section' | 'group';
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, subtitle, icon: Icon, iconClassName, action, level = 'section', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'surface-transition flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-center',
        level === 'view' && 'mb-8 border-b border-border/70 pb-6',
        level === 'section' && 'mb-5',
        level === 'group' && 'mb-3',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className={cn('flex min-w-0 items-center gap-2.5', level === 'group' && 'gap-2')}>
          {Icon && (
            <span
              className={cn(
                'surface-transition flex shrink-0 items-center justify-center rounded-lg',
                level === 'view' && 'h-11 w-11 rounded-card border border-primary/20 bg-primary/10 text-primary shadow-depth-1',
                level === 'section' && 'p-1 bg-muted text-muted-foreground',
                level === 'group' && 'text-muted-foreground/50',
                iconClassName,
              )}
            >
              <Icon
                className={cn(
                  level === 'view' && 'w-5 h-5',
                  level === 'section' && 'w-4 h-4',
                  level === 'group' && 'w-3 h-3',
                )}
              />
            </span>
          )}

          {level === 'view' ? (
            <h1 className="min-w-0 break-words text-view-title font-bold tracking-tight text-foreground">{title}</h1>
          ) : level === 'section' ? (
            <h2 className="min-w-0 break-words text-section-title font-bold tracking-tight text-foreground/85">{title}</h2>
          ) : (
            <span className="min-w-0 break-words text-label font-black uppercase tracking-label text-muted-foreground/55">{title}</span>
          )}
        </div>

        {subtitle && (
          <p
            className={cn(
              'mt-2 max-w-3xl break-words text-caption leading-relaxed text-muted-foreground',
              level === 'group' && 'mt-0.5 text-muted-foreground/70',
              Icon && level !== 'group' && 'sm:ml-[3.75rem]',
              Icon && level === 'group' && 'ml-5',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 [&>*]:w-full sm:w-auto sm:max-w-[min(100%,32rem)] sm:justify-end sm:[&>*]:w-auto">
          {action}
        </div>
      )}
    </div>
  ),
);
SectionHeader.displayName = 'SectionHeader';
