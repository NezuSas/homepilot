import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SurfaceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

/** Interactive card/option surface, not a conventional action button. */
export const SurfaceButton = React.forwardRef<HTMLButtonElement, SurfaceButtonProps>(
  ({ className, isLoading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'control-transition inline-flex min-w-0 max-w-full touch-manipulation items-center justify-center break-words text-center font-semibold leading-tight',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:opacity-45 disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  )
);
SurfaceButton.displayName = 'SurfaceButton';
