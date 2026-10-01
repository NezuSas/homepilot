import React from 'react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  className,
  children,
  ...props
}) => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-busy="true"
    aria-label={label}
    className={cn('min-w-0 w-full space-y-6', className)}
    {...props}
  >
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      {children}
    </div>
  </div>
);
