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

    return (
      <div
        ref={ref}
        {...props}
        aria-hidden={isDismissed || undefined}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'relative flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card p-3 transition-colors',
          isDismissed ? 'pointer-events-none opacity-0' : 'hover:border-primary/35',
          className,
        )}
      >
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-control border',
            severity ? severityClasses[severity] : 'border-primary/20 bg-primary/10 text-primary',
          )}>
            <Icon aria-hidden="true" className={cn('h-5 w-5', iconClassName)} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 id={titleId} className="break-words text-body font-bold tracking-tight text-foreground">
              {title}
            </h3>
            {category !== title && <p className="text-caption text-muted-foreground">{category}</p>}
          </div>

          {severity && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[0.5625rem] font-semibold uppercase leading-none tracking-label', severityClasses[severity])}>
              {t(`common.severity_${severity}`, { defaultValue: severity })}
            </span>
          )}
        </div>

        <p id={descriptionId} className="mt-2 break-words text-caption leading-relaxed text-muted-foreground">
          {description}
        </p>

        {children && <div className="mt-2">{children}</div>}

        {actions && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    );
  },
);
AssistantCard.displayName = 'AssistantCard';
