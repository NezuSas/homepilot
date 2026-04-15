import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, disabled, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className={cn("text-[10px] font-black uppercase tracking-widest ml-1", error ? "text-danger" : "text-muted-foreground", disabled && "opacity-50")}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full appearance-none items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer",
              "border-border placeholder:text-muted-foreground/40",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50 font-bold",
              error && "border-danger/50 focus:ring-danger/40 focus:border-danger bg-danger/5",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none", disabled && "opacity-50")} />
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
