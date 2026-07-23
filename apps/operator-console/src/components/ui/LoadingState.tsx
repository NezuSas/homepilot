import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const spinnerSizes: Record<NonNullable<LoadingStateProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  size = 'lg',
  className,
  ...props
}) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={label}
    className={cn('flex flex-col items-center justify-center gap-4 text-center', className)}
    {...props}
  >
    <Loader2 aria-hidden="true" className={cn('animate-spin text-primary/40', spinnerSizes[size])} />
    <p className="text-micro font-black uppercase tracking-label-wider text-muted-foreground/60">{label}</p>
  </div>
);
