import React from 'react';
import { cn } from '../../lib/utils';

export interface DeviceTileShellProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  tone?: 'brand' | 'light';
  disabled?: boolean;
  interactive?: boolean;
  syncing?: boolean;
  children: React.ReactNode;
}

export const DeviceTileShell = React.forwardRef<HTMLDivElement, DeviceTileShellProps>(
  (
    {
      active = false,
      tone = 'brand',
      disabled = false,
      interactive = false,
      syncing = false,
      className,
      children,
      onKeyDown,
      role,
      tabIndex,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive && !disabled;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !isInteractive) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      event.currentTarget.click();
    };

    return (
      <div
        ref={ref}
        role={role || (isInteractive ? 'button' : undefined)}
        tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
        onKeyDown={handleKeyDown}
        className={cn(
          'surface-transition relative flex h-full min-h-[9rem] flex-col justify-between overflow-hidden rounded-card border p-4 group',
          isInteractive ? 'interactive-lift cursor-pointer' : 'cursor-default',
          active ? 'device-state-on' : 'device-state-off',
          tone === 'light' && 'device-tone-light',
          syncing && 'ring-1 ring-primary/15',
          disabled && 'pointer-events-none select-none opacity-30 grayscale',
          className
        )}
        {...props}
      >
        {syncing && (
          <div className="pointer-events-none absolute inset-0 z-0 bg-primary/5 animate-pulse" />
        )}
        {children}
      </div>
    );
  }
);

DeviceTileShell.displayName = 'DeviceTileShell';
