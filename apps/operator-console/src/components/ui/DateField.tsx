import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input, type InputProps } from './Input';
import { cn } from '../../lib/utils';

/** Native date interaction with a visible empty state, including WebKit on tablets. */
export function DateField({ value, className, ...props }: Omit<InputProps, 'type' | 'icon'>) {
  const { t } = useTranslation();
  return <div className="relative min-w-0">
    <Input {...props} type="date" value={value} data-empty={!value || undefined}
      icon={<CalendarDays aria-hidden className="size-4" />}
      className={cn('homepilot-date-field h-11 min-h-11 appearance-none text-foreground', className)} />
    {!value && <span aria-hidden className="pointer-events-none absolute bottom-0 left-10 flex h-11 items-center text-body text-muted-foreground">
      {t('diagnostics.filters.choose_date')}
    </span>}
  </div>;
}
