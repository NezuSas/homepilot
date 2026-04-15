import React from 'react';
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
          "relative border-2 rounded-[2rem] p-6 overflow-hidden transition-all duration-500 flex flex-col md:flex-row gap-6",
          isDismissed ? "opacity-0 translate-x-12 scale-95 pointer-events-none" : "hover:-translate-y-1 hover:shadow-xl",
          !severity ? "border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 shadow-lg shadow-primary/10 hover:shadow-primary/20" : "bg-card border-border shadow-md",
          className
        )}
        {...props}
      >
        {/* Background gradient hint */}
        {!severity && <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -z-10" />}

        {/* Header Icon + Severity */}
        <div className="flex flex-col items-start gap-4">
          <div className={cn(
            "p-4 rounded-2xl border shadow-inner",
            severity ? severityClasses[severity] : "border-primary/20 bg-primary/10 text-primary shadow-primary/20"
          )}>
            <Icon className={cn("w-6 h-6", iconClassName)} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground"
                )}>
                    {category}
                </span>
                {severity && (
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                        severityClasses[severity]
                    )}>
                        {severity}
                    </span>
                 )}
            </div>
            
            <h3 className={cn("text-lg font-bold tracking-tight mb-2", severity ? severityTextClasses[severity] : "text-foreground")}>{title}</h3>
            <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed mb-6">
                {description}
            </p>

            {children}
            
            {/* Actions */}
            {actions && (
                <div className="flex items-center gap-3 mt-4">
                    {actions}
                </div>
            )}
        </div>
      </div>
    );
  }
);
AssistantCard.displayName = 'AssistantCard';
