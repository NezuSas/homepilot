import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}

const variantConfig: Record<
  NonNullable<AlertBannerProps['variant']>,
  { icon: LucideIcon; className: string; iconClassName: string }
> = {
  info: {
    icon: Info,
    className: 'border-primary/20 bg-primary/5 text-primary',
    iconClassName: 'bg-primary text-primary-foreground',
  },
  success: {
    icon: CheckCircle,
    className: 'border-success/20 bg-success/5 text-success',
    iconClassName: 'bg-success text-success-foreground',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/20 bg-warning/5 text-warning',
    iconClassName: 'bg-warning text-warning-foreground',
  },
  danger: {
    icon: AlertTriangle,
    className: 'border-danger/20 bg-danger/5 text-danger',
    iconClassName: 'bg-danger text-danger-foreground',
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  variant = 'info',
  title,
  message,
  action,
  icon,
  className,
  ...props
}) => {
  const config = variantConfig[variant];
  const Icon = icon || config.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-panel border p-5 backdrop-blur-xl',
        config.className,
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-control', config.iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          {title && <p className="text-body font-black text-foreground">{title}</p>}
          <p className="text-label font-black uppercase tracking-widest opacity-70">{message}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
