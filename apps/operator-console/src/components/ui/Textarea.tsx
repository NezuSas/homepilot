import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, label, error, helperText, disabled, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'ml-1 text-micro font-black uppercase tracking-widest',
              error ? 'text-danger' : 'text-muted-foreground',
              disabled && 'opacity-50',
            )}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          className={cn(
            'surface-transition min-h-24 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-body shadow-sm',
            'placeholder:text-muted-foreground/40',
            'focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-depth-1',
            'disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50',
            error && 'border-danger/50 bg-danger/5 focus-visible:border-danger focus-visible:ring-danger/40',
            className,
          )}
          {...props}
        />
        {(error || helperText) && (
          <p className={cn('ml-1 text-micro font-medium', error ? 'animate-shake text-danger' : 'text-muted-foreground opacity-70')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
