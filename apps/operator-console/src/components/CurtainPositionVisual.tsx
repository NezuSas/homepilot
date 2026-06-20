import { ArrowDown, ArrowUp, Blinds } from 'lucide-react';
import { cn } from '../lib/utils';

interface CurtainPositionVisualProps {
  position: number;
  movement: 'opening' | 'closing' | null;
}

export function CurtainPositionVisual({ position, movement }: CurtainPositionVisualProps) {
  const clampedPosition = Math.min(100, Math.max(0, position));
  const coveredHeight = Math.max(8, 100 - clampedPosition);
  const MovementIcon = movement === 'opening' ? ArrowUp : movement === 'closing' ? ArrowDown : Blinds;

  return (
    <div
      className="relative h-16 overflow-hidden rounded-control border border-border/70 bg-background/75 shadow-inner"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-card/60 to-primary/5" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border/45" />
      <div
        className={cn(
          'absolute inset-x-0 top-0 overflow-hidden border-b border-primary/35 bg-primary/20 shadow-[0_5px_16px_hsl(var(--primary)/0.16)]',
          'transition-[height] duration-700 ease-in-out',
          movement && 'bg-primary/30',
        )}
        style={{ height: `${coveredHeight}%` }}
      >
        <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/70" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <MovementIcon className={cn('h-5 w-5 text-foreground/70', movement && 'animate-pulse text-primary')} />
      </div>
      <span className="absolute bottom-1.5 right-2 rounded-pill border border-border/70 bg-card/90 px-2 py-0.5 text-micro font-black text-foreground shadow-sm">
        {Math.round(clampedPosition)}%
      </span>
    </div>
  );
}
