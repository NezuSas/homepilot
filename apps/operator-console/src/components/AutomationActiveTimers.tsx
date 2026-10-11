import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';
import { StatusPill } from './ui/StatusPill';
import type { ActiveTimer } from '../views/automationsModel';

interface AutomationActiveTimersProps {
  timers: ActiveTimer[];
  currentUserId: string | null;
  processingId: string | null;
  onCancel: (id: string) => void;
}

/** Pending one-shot timers with their remaining time and an owner-only cancel action. */
export function AutomationActiveTimers({ timers, currentUserId, processingId, onCancel }: AutomationActiveTimersProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-dashboard border border-primary/20 bg-card/70 p-5 shadow-depth-3 sm:p-6" aria-labelledby="active-timers-title">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Clock3 className="size-5" /></div><div><Heading id="active-timers-title" variant="section" as="h2">{t('automations.timers.title')}</Heading><p className="mt-1 text-sm text-muted-foreground">{t('automations.timers.description')}</p></div></div>
        <StatusPill variant="primary" size="lg">{t('automations.timers.pending_count', { count: timers.length })}</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{timers.map(({ rule, remainingMinutes }) => <article key={rule.id} className="flex flex-col gap-4 rounded-card border border-border/70 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-section-title">{rule.name}</p><p className="mt-1 text-sm text-muted-foreground">{remainingMinutes >= 60 ? t('automations.timers.remaining_hours', { count: Math.ceil(remainingMinutes / 60) }) : t('automations.timers.remaining_minutes', { count: remainingMinutes })}</p></div>{rule.userId === currentUserId && <Button type="button" variant="outline" size="sm" isLoading={processingId === rule.id} onClick={() => onCancel(rule.id)} className="shrink-0 border-danger/30 text-danger hover:bg-danger/10">{t('automations.timers.cancel')}</Button>}</article>)}</div>
    </section>
  );
}
