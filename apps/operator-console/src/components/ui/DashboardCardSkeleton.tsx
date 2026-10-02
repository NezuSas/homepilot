import { cn } from '../../lib/utils';

export type DashboardCardSkeletonVariant = 'control' | 'sensor' | 'camera' | 'media' | 'climate' | 'energy' | 'display' | 'generic';

interface DashboardCardSkeletonProps {
  variant: DashboardCardSkeletonVariant;
  className?: string;
  mediaOnly?: boolean;
  visible?: boolean;
}

export function DashboardSkeletonBar({ className }: { className: string }) {
  return <span className={cn('block rounded-control bg-muted/85 dark:bg-muted/70', className)} />;
}

/** Presentation only: the outer card/grid cell owns its dimensions and interactions. */
export function DashboardCardSkeleton({ variant, className, mediaOnly = false, visible = true }: DashboardCardSkeletonProps) {
  return (
    <div
      data-dashboard-skeleton={visible ? variant : undefined}
      aria-hidden="true"
      style={variant === 'sensor' ? { containerType: 'inline-size', containerName: 'sensor-card' } : undefined}
      className={cn(
        'homepilot-dashboard-card-skeleton pointer-events-none flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-card/95 shadow-surface-card',
        variant !== 'sensor' && 'rounded-section p-4',
        !mediaOnly && 'border border-border/60',
        visible && 'homepilot-dashboard-skeleton-motion',
        variant === 'camera' && 'relative aspect-[4/3] min-h-curtain-card max-h-[22rem] p-0',
        variant === 'media' && 'min-h-media-card',
        variant === 'sensor' && 'homepilot-sensor-reading',
        className,
      )}
    >
      {visible ? variant === 'camera' ? (
        <>
          <DashboardSkeletonBar className="absolute inset-0 rounded-none" />
          {!mediaOnly && <div className="absolute inset-x-0 bottom-0 space-y-2 p-4"><DashboardSkeletonBar className="h-5 w-1/2" /><DashboardSkeletonBar className="h-3 w-1/3" /></div>}
        </>
      ) : variant === 'sensor' ? (
        <>
          <div className="sensor-premium-header"><DashboardSkeletonBar className="sensor-category-icon shrink-0" /><div className="w-full min-w-0"><DashboardSkeletonBar className="h-3 w-3/4" /></div></div>
          <div className="sensor-reading-layout sensor-analog-layout"><div className="sensor-analog-instrument"><div className="sensor-analog-skeleton" /><div className="sensor-analog-readout"><DashboardSkeletonBar className="mx-auto h-8 w-16" /><DashboardSkeletonBar className="mx-auto mt-1 h-3 w-6" /></div></div></div>
          <div className="sensor-reading-footer"><DashboardSkeletonBar className="mx-auto h-7 w-3/5 rounded-full" /><DashboardSkeletonBar className="mx-auto h-3 w-4/5" /></div>
        </>
      ) : variant === 'media' ? (
        <>
          <DashboardSkeletonBar className="h-4 w-2/5" />
          <div className="mt-4 flex min-h-0 flex-1 items-start justify-between gap-4"><div className="space-y-3"><DashboardSkeletonBar className="h-6 w-36 max-w-full" /><DashboardSkeletonBar className="h-3 w-24" /></div><DashboardSkeletonBar className="h-20 w-20 shrink-0 rounded-xl" /></div>
          <div className="flex items-center gap-3"><DashboardSkeletonBar className="h-8 w-8" /><DashboardSkeletonBar className="h-8 w-8" /><DashboardSkeletonBar className="h-8 w-8" /></div>
        </>
      ) : variant === 'control' || variant === 'display' ? (
        <div className="flex h-full flex-col justify-between gap-3"><DashboardSkeletonBar className="h-11 w-11" /><div className="space-y-2"><DashboardSkeletonBar className="h-5 w-3/4" /><DashboardSkeletonBar className="h-3 w-1/2" /></div></div>
      ) : variant === 'climate' || variant === 'energy' ? (
        <div className="flex h-full flex-col justify-between gap-4"><div className="flex items-center gap-3"><DashboardSkeletonBar className="h-10 w-10" /><DashboardSkeletonBar className="h-3 w-1/3" /></div><DashboardSkeletonBar className="h-12 w-1/2" /><DashboardSkeletonBar className="h-2 w-full" /></div>
      ) : (
        <div className="flex h-full flex-col justify-between gap-4"><DashboardSkeletonBar className="h-10 w-10" /><DashboardSkeletonBar className="h-5 w-2/3" /><DashboardSkeletonBar className="h-3 w-1/2" /></div>
      ) : null}
    </div>
  );
}
