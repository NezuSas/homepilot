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
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label 
            htmlFor={props.id}
            className={cn("text-[10px] font-black uppercase tracking-widest ml-1", error ? "text-danger" : "text-muted-foreground", disabled && "opacity-50")}
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
              "placeholder:text-muted-foreground/40 font-bold",
              variant === 'default' && "h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus:ring-primary/40",
              variant === 'small' && "h-7 rounded-lg border border-border/50 bg-background px-2 py-0.5 text-[11px] focus:ring-primary/40",
              variant === 'primary' && "h-11 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 border-none active:scale-95 text-center",
              variant === 'ghost' && "bg-transparent border-none px-2 py-1 text-sm focus:ring-0",
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
          <p className={cn("text-[10px] font-medium ml-1", error ? "text-danger animate-shake" : "text-muted-foreground opacity-70")}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
