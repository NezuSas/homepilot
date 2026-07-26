import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface SelectableOptionCardProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}

export const SelectableOptionCard = React.forwardRef<HTMLButtonElement, SelectableOptionCardProps>(
  ({
    title,
    description,
    checked,
    className,
    titleClassName,
    descriptionClassName,
    type = 'button',
    ...props
  }, ref) => (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="sm"
      role="radio"
      aria-checked={checked}
      className={cn(
        'relative h-auto min-h-12 w-full justify-start rounded-card border p-3 pr-10 text-left shadow-sm',
        'whitespace-normal transition-colors focus-visible:ring-primary/55',
        checked
          ? 'border-primary/60 bg-primary/10 text-foreground shadow-primary/10'
          : 'border-border/50 bg-card hover:border-primary/30 hover:bg-muted/30',
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className={cn('break-words text-body font-semibold leading-snug', titleClassName)}>{title}</span>
        {description && (
          <span className={cn('break-words text-caption leading-relaxed text-muted-foreground', descriptionClassName)}>
            {description}
          </span>
        )}
      </span>
      {checked && (
        <Check aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-primary" />
      )}
    </Button>
  )
);

SelectableOptionCard.displayName = 'SelectableOptionCard';
