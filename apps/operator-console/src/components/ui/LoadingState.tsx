import React from 'react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'list' | 'cards' | 'home';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  size = 'lg',
  layout = 'list',
  className,
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
      {layout === 'home' ? <div className="homepilot-home-hero flex min-w-0 flex-col justify-center gap-4 bg-card p-6 sm:p-8"><div className="h-10 w-2/3 rounded-control bg-muted" /><div className="h-5 w-1/2 rounded-control bg-muted" /><div className="h-24 w-64 max-w-full rounded-section bg-muted" /></div> : <div className="space-y-2"><div className="h-7 w-40 max-w-full rounded-control bg-muted" /><div className="h-4 w-64 max-w-full rounded-control bg-muted" /></div>}
      <div className={layout === 'cards' || layout === 'home' ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),min(100%,20rem)))] gap-3' : 'space-y-3'}>
        {Array.from({ length: size === 'sm' ? 2 : 3 }, (_, index) => <div key={index} className={cn('flex min-w-0 gap-3 rounded-section border border-border bg-card p-3', layout !== 'list' && 'flex-col')}>
          <div className="flex min-w-0 flex-1 items-center gap-3"><div className="h-10 w-10 shrink-0 rounded-control bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded-control bg-muted" /><div className="h-3 w-1/2 rounded-control bg-muted" /></div></div>
          {layout !== 'list' && <div className="h-11 rounded-control bg-muted" />}
        </div>)}
      </div>
    </div>
  </div>
);
