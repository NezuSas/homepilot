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
    
    // Severidad mapeada a tokens semánticos
    const severityClasses = {
      critical: "border-danger bg-danger/10 shadow-danger/20 text-danger",
      high: "border-danger/40 bg-danger/5 shadow-danger/10 text-danger",
      medium: "border-warning/40 bg-warning/5 shadow-warning/10 text-warning",
      low: "border-success/40 bg-success/5 shadow-success/10 text-success"
    };

    const severityTextClasses = {
      critical: "text-danger",
      high: "text-danger",
      medium: "text-warning",
      low: "text-success",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-panel border-2 p-4 transition-all duration-500 sm:gap-5 sm:p-5 md:flex-row md:gap-6 md:p-6",
          isDismissed ? "opacity-0 translate-x-12 scale-95 pointer-events-none" : "hover:-translate-y-1 hover:shadow-xl",
          !severity ? "border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 shadow-lg shadow-primary/10 hover:shadow-primary/20" : "bg-card border-border shadow-md",
          className
        )}
        {...props}
      >
        {/* Background gradient hint */}
        {!severity && <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -z-10" />}

        {/* Header Icon + Severity */}
        <div className="flex shrink-0 flex-col items-start gap-4">
          <div className={cn(
            "p-4 rounded-2xl border shadow-inner",
            severity ? severityClasses[severity] : "border-primary/20 bg-primary/10 text-primary shadow-primary/20"
          )}>
            <Icon className={cn("w-6 h-6", iconClassName)} />
          </div>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={cn(
                    "max-w-full break-words rounded bg-muted px-2 py-0.5 text-micro font-black uppercase tracking-widest text-muted-foreground"
                )}>
                    {category}
                </span>
                {severity && (
                    <span className={cn(
                        "max-w-full break-words rounded-full border px-2.5 py-1 text-micro font-black uppercase tracking-widest",
                        severityClasses[severity]
                    )}>
                        {t(`common.severity_${severity}`, { defaultValue: severity })}
                    </span>
                 )}
            </div>
            
            <h3 className={cn("mb-2 break-words text-section-title font-bold tracking-tight", severity ? severityTextClasses[severity] : "text-foreground")}>{title}</h3>
            <p className="mb-4 break-words text-body font-medium leading-relaxed text-muted-foreground/80 sm:mb-6">
                {description}
            </p>

            {children}
            
            {/* Actions */}
            {actions && (
                <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                    {actions}
                </div>
            )}
        </div>
      </div>
    );
  }
);
AssistantCard.displayName = 'AssistantCard';
