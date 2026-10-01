import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'collection';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
  ...props
}) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'flex min-w-0 flex-col items-center justify-center rounded-panel border border-border/45 bg-card/35 px-4 py-10 text-center shadow-depth-1 backdrop-blur-md sm:px-6 sm:py-16',
        variant === 'collection' && 'rounded-section bg-card px-5 py-8 shadow-none sm:py-10',
        className
      )}
      {...props}
    >
      {Icon && (
        <div className={cn('mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1', variant === 'collection' && 'h-20 w-20 rounded-section shadow-none')}>
          <Icon aria-hidden="true" className={variant === 'collection' ? 'h-9 w-9' : 'h-5 w-5'} />
        </div>
      )}
      <h3 id={titleId} className="min-w-0 break-words text-section-title font-black tracking-tight text-foreground/90">{title}</h3>
      {description && (
        <p id={descriptionId} className="mt-2 max-w-md break-words text-body font-medium leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6 flex w-full justify-center [&>*]:w-full sm:w-auto sm:[&>*]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
};
