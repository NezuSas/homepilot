import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface AssistantCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  iconClassName?: string;
  category: string;
  title: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  actions?: React.ReactNode;
  children?: React.ReactNode;
  isDismissed?: boolean;
}

export const AssistantCard = React.forwardRef<HTMLDivElement, AssistantCardProps>(
  ({ className, icon: Icon, iconClassName, category, title, description, severity, actions, children, isDismissed = false, ...props }, ref) => {
    const { t } = useTranslation();
    const titleId = React.useId();
    const descriptionId = React.useId();
    const severityClasses = {
      critical: 'border-danger/30 bg-danger/10 text-danger',
      high: 'border-danger/25 bg-danger/10 text-danger',
      medium: 'border-warning/30 bg-warning/10 text-warning',
      low: 'border-success/30 bg-success/10 text-success',
    };
    const severityAccentClasses = {
      critical: 'bg-danger',
      high: 'bg-danger',
      medium: 'bg-warning',
      low: 'bg-success',
    };

    return (
      <div
        ref={ref}
        {...props}
        aria-hidden={isDismissed || undefined}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'relative flex h-full min-w-0 flex-col overflow-hidden rounded-panel border border-border/80 bg-card p-4 shadow-depth-1 transition-all duration-300 sm:p-5',
          isDismissed ? 'pointer-events-none translate-x-12 scale-95 opacity-0' : 'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-depth-2',
          className,
        )}
      >
        {severity && (
          <span
            aria-hidden="true"
            className={cn('absolute bottom-4 left-0 top-4 w-1 rounded-r-full sm:bottom-5 sm:top-5', severityAccentClasses[severity])}
          />
        )}

        <div className="flex min-w-0 items-start gap-3 pl-2">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-control border',
            severity ? severityClasses[severity] : 'border-primary/20 bg-primary/10 text-primary',
          )}>
            <Icon aria-hidden="true" className={cn('h-5 w-5', iconClassName)} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="mb-1 text-nano font-bold uppercase tracking-label text-muted-foreground">
              {category}
            </p>
            <h3 id={titleId} className="break-words text-body font-bold tracking-tight text-foreground">
              {title}
            </h3>
          </div>

          {severity && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[0.5625rem] font-semibold uppercase leading-none tracking-label', severityClasses[severity])}>
              {t(`common.severity_${severity}`, { defaultValue: severity })}
            </span>
          )}
        </div>

        <p id={descriptionId} className="mt-3 break-words pl-2 text-caption leading-relaxed text-muted-foreground">
          {description}
        </p>

        {children && <div className="mt-3 pl-2">{children}</div>}

        {actions && (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 pl-2">
            {actions}
          </div>
        )}
      </div>
    );
  },
);
AssistantCard.displayName = 'AssistantCard';
