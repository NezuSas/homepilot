import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-col items-center justify-center rounded-panel border border-border/45 bg-card/35 px-4 py-10 text-center shadow-depth-1 backdrop-blur-md sm:px-6 sm:py-16',
      className
    )}
    {...props}
  >
    {Icon && (
      <div className="mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
        <Icon className="h-5 w-5" />
      </div>
    )}
    <h3 className="min-w-0 break-words text-section-title font-black tracking-tight text-foreground/90">{title}</h3>
    {description && (
      <p className="mt-2 max-w-md break-words text-body font-medium leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="mt-6 flex w-full justify-center sm:w-auto">{action}</div>}
  </div>
);
