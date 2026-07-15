import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'small' | 'primary' | 'ghost';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, disabled, children, variant = 'default', ...props }, ref) => {
    const isPlaceholder = props.value === '' || props.value === undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label 
            htmlFor={props.id}
            className={cn("text-micro font-black uppercase tracking-widest ml-1", error ? "text-danger" : "text-muted-foreground", disabled && "opacity-50")}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              "flex w-full appearance-none items-center justify-between transition-all focus:outline-none focus:ring-2 cursor-pointer",
              "font-bold",
              isPlaceholder ? "text-muted-foreground/40" : "text-foreground",
              variant === 'default' && "h-11 rounded-xl border border-border/40 bg-muted/20 px-4 py-2 text-body shadow-sm focus:ring-primary/40 focus:border-primary/40 focus:bg-background",
              variant === 'small' && "h-8 rounded-lg border border-border/50 bg-muted/20 px-2 py-0.5 text-label focus:ring-primary/40 focus:bg-background",
              variant === 'primary' && "h-14 rounded-2xl bg-primary text-primary-foreground px-6 py-2 text-caption font-black uppercase tracking-widest shadow-lg shadow-primary/20 border-none active:scale-95 text-center",
              variant === 'ghost' && "bg-transparent border border-transparent hover:border-border/40 focus:border-primary/40 px-2 py-1 text-body focus:ring-0",
              "[&>option]:bg-popover [&>option]:text-popover-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
              error && "border-danger/50 focus:ring-danger/40 focus:border-danger bg-danger/5",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className={cn(
            "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-all",
            variant === 'small' ? "right-2 w-3 h-3" : "right-3 w-4 h-4",
            variant === 'primary' && "text-primary-foreground/60",
            disabled && "opacity-50"
          )} />
        </div>
        {(error || helperText) && (
          <p className={cn("text-micro font-medium ml-1", error ? "text-danger animate-shake" : "text-muted-foreground opacity-70")}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
