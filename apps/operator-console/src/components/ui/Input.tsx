import React from 'react';
import { cn } from '../../lib/utils';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, disabled, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className={cn("text-[10px] font-black uppercase tracking-widest ml-1", error ? "text-danger" : "text-muted-foreground", disabled && "opacity-50")}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className={cn("absolute left-3 text-muted-foreground", disabled && "opacity-50")}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm transition-all shadow-sm",
              "border-border placeholder:text-muted-foreground/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
              error && "border-danger/50 focus-visible:ring-danger/40 focus-visible:border-danger bg-danger/5",
              icon && "pl-10",
              className
            )}
            {...props}
          />
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
Input.displayName = 'Input';

export function SearchInput(props: Omit<InputProps, 'icon'>) {
    return <Input icon={<Search className="w-4 h-4" />} {...props} />;
}
