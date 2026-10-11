import { CalendarDays } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { Input } from './Input';
import { cn } from '../../lib/utils';

/** Native date interaction with a visible empty state, including WebKit on tablets. */
export interface DateFieldProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'type' | 'icon'> {
  /** Text shown over the empty field (for example "Choose a date"). */
  placeholderLabel?: string;
}

export function DateField({ value, className, placeholderLabel = 'Choose a date', ...props }: DateFieldProps) {
  return <div className="relative min-w-0">
    <Input {...props} type="date" value={value} data-empty={!value || undefined}
      icon={<CalendarDays aria-hidden className="size-4" />}
      className={cn('homepilot-date-field h-11 min-h-11 appearance-none text-foreground', className)} />
    {!value && <span aria-hidden className="pointer-events-none absolute bottom-0 left-10 flex h-11 items-center text-body text-muted-foreground">
      {placeholderLabel}
    </span>}
  </div>;
}
