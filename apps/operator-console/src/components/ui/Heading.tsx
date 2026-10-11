import React from 'react';
import { cn } from '../../lib/utils';

export type HeadingVariant = 'view' | 'section' | 'card' | 'item' | 'label';
export type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Text style of the catalog. The semantic element defaults to the one that fits the style. */
  variant?: HeadingVariant;
  /** Overrides the semantic element without changing the visual style. */
  as?: HeadingElement;
}

const variantStyles: Record<HeadingVariant, string> = {
  view: 'text-view-title font-bold tracking-tight text-foreground',
  section: 'text-section-title font-bold tracking-tight text-foreground/85',
  card: 'text-card-title font-bold leading-snug tracking-tight text-foreground',
  item: 'text-body-compact font-semibold text-foreground',
  label: 'text-label font-black uppercase tracking-label text-muted-foreground/55',
};

const defaultElement: Record<HeadingVariant, HeadingElement> = {
  view: 'h1',
  section: 'h2',
  card: 'h3',
  item: 'h3',
  label: 'span',
};

/** The single place where titles get their typography; pick a variant, never raw text classes. */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant = 'section', as, ...props }, ref) => {
    const Element = (as ?? defaultElement[variant]) as React.ElementType;
    return <Element ref={ref} className={cn('min-w-0 break-words', variantStyles[variant], className)} {...props} />;
  },
);
Heading.displayName = 'Heading';
