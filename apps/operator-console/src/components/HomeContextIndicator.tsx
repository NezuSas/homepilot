import type { ReactNode, ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

interface HomeContextIndicatorProps {
  icon: LucideIcon | ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  primaryIcon?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}

/** Shared visual primitive for the compact context indicators in Inicio. */
export function HomeContextIndicator({ icon: Icon, children, className, primaryIcon = false, onClick, actionLabel }: HomeContextIndicatorProps) {
  const styles = cn(
    'flex min-w-0 flex-1 items-center gap-2 rounded-card border border-border/60 bg-card/80 px-3 py-2.5 text-caption text-muted-foreground shadow-sm sm:flex-none',
    onClick && 'cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    className,
  );
  const content = <>
    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', primaryIcon ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
    <span className="min-w-0">
      <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap font-semibold text-foreground">{children}</span>
    </span>
  </>;

  return onClick
    ? <Button type="button" variant="ghost" size="lg" className={cn('justify-start font-normal leading-normal hover:bg-card/80 hover:translate-y-0 active:scale-100', styles)} onClick={onClick} aria-label={actionLabel}>{content}</Button>
    : <div className={styles}>{content}</div>;
}
