import React from 'react';
import { cn } from '../../lib/utils';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, helperText, icon, disabled, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn("flex min-w-0 w-full flex-col gap-1.5", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={cn("ml-1 break-words text-micro font-black uppercase tracking-widest", error ? "text-danger" : "text-muted-foreground", disabled && "opacity-50")}>
            {label}
          </label>
        )}
        <div className="relative flex min-w-0 items-center">
          {icon && (
            <div className={cn("pointer-events-none absolute left-3 text-muted-foreground surface-transition", disabled && "opacity-50")}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              "surface-transition flex h-10 min-w-0 w-full rounded-xl border bg-background px-3 py-2 text-body shadow-sm",
              "border-border placeholder:text-muted-foreground/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:shadow-depth-1",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
              error && "border-danger/50 focus-visible:ring-danger/40 focus-visible:border-danger bg-danger/5",
              icon && "pl-10",
              className
            )}
            {...props}
          />
        </div>
        {(error || helperText) && (
          <p className={cn("ml-1 break-words text-micro font-medium", error ? "text-danger animate-shake" : "text-muted-foreground opacity-70")}>
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
