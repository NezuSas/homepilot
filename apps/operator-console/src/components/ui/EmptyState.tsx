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
      'flex flex-col items-center justify-center rounded-panel border-2 border-dashed border-border/30 bg-card/10 px-6 py-16 text-center',
      className
    )}
    {...props}
  >
    {Icon && (
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-panel bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    )}
    <h3 className="text-lg font-black tracking-tight text-foreground/90">{title}</h3>
    {description && (
      <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
