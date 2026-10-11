import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, label, error, helperText, disabled, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const messageId = `${textareaId}-message`;
    const describedBy = [ariaDescribedBy, (error || helperText) && messageId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('flex min-w-0 w-full flex-col gap-2', containerClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'hp-field-label',
              error && 'text-danger',
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
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={cn(
            'hp-text-field min-h-24 resize-y',
            error && 'border-danger/50 bg-danger/5 focus-visible:border-danger focus-visible:ring-danger/40',
            className,
          )}
          {...props}
        />
        {(error || helperText) && (
          <p
            id={messageId}
            role={error ? 'alert' : undefined}
            aria-live={error ? 'assertive' : 'polite'}
            className={cn('hp-field-message', error ? 'text-danger' : 'text-muted-foreground')}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
