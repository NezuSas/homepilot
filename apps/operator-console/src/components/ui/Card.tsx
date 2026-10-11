import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'flat' | 'error' | 'active';
  /** Corner radius token of the catalog. */
  radius?: 'card' | 'section' | 'panel';
  /** Native element to render, so landmarks keep their semantics (article, section, aside). */
  as?: 'div' | 'article' | 'section' | 'aside';
}

const variantStyles: Record<NonNullable<CardProps['variant']>, string> = {
  default:
    'bg-card/85 border-border/70 shadow-depth-1 hover:border-border hover:shadow-depth-2',
  elevated:
    'bg-popover border-border/50 shadow-depth-2 hover:shadow-depth-3',
  flat:
    'bg-card border-border',
  glass:
    'bg-card/35 backdrop-blur-xl border-border/45 shadow-depth-1',
  error:
    'bg-danger/5 border-danger/25 shadow-sm',
  active:
    'device-state-on',
};

const radiusStyles: Record<NonNullable<CardProps['radius']>, string> = {
  card: 'rounded-card',
  section: 'rounded-section',
  panel: 'rounded-panel',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', radius = 'card', as: Element = 'div', ...props }, ref) => (
    <Element
      ref={ref}
      className={cn(
        'surface-transition min-w-0 overflow-hidden border',
        radiusStyles[radius],
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex min-w-0 flex-col space-y-1.5 p-4 sm:p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('min-w-0 break-words text-section-title font-bold leading-snug tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('break-words text-caption leading-relaxed text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-3 p-4 pt-0 max-sm:[&>button]:w-full sm:p-6 sm:pt-0 sm:[&>button]:w-auto',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
