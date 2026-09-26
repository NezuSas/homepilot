import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { getDashboardIconComponent } from '../components/IconPicker';
import { formatTemperature, getClockLocale, isDaytimeHour } from './clock/clockUtils';
import { getWeatherCategory, WeatherScene } from './clock/designs/WeatherScene';
import { useCuencaWeather } from './clock/useCuencaWeather';
import type { DashboardTitleTabRef, TitleAlign, TitleBadge } from './dashboardTitleContent';

const badgePillClass = 'flex shrink-0 items-center gap-1.5 rounded-full border border-border/55 bg-background/40 px-3 py-1 text-clock-label-fluid font-black uppercase tracking-micro text-foreground shadow-inner transition hover:border-primary/50 hover:bg-primary/10';

/** Brief weather + temperature badge, Home Assistant dashboard-badge style. */
function WeatherBadgeContent() {
  const { weather, status } = useCuencaWeather(getClockLocale());
  const isReady = Boolean(weather) && status === 'ready';

  if (!isReady) return null;

  const category = getWeatherCategory(weather!.code, isDaytimeHour(new Date()));

  return (
    <span className={badgePillClass}>
      <WeatherScene category={category} size="sm" className="h-4 w-4" />
      <span>{formatTemperature(weather!.temperature)}</span>
    </span>
  );
}

/** Live HH:MM badge; updates every 30s, which is plenty for a minute-resolution clock. */
function TimeBadgeContent() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const time = new Intl.DateTimeFormat(getClockLocale(), { hour: '2-digit', minute: '2-digit' }).format(now);

  return (
    <span className={badgePillClass}>
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span>{time}</span>
    </span>
  );
}

/** Jumps straight to another tab of this dashboard when clicked. */
function TabBadgeContent({ tab, onSelectTab }: { tab: DashboardTitleTabRef; onSelectTab?: (tabId: string) => void }) {
  const Icon = tab.icon ? getDashboardIconComponent(tab.icon) : null;

  return (
    <Button
      type="button"
      onClick={(event) => { event.stopPropagation(); onSelectTab?.(tab.id); }}
      aria-label={tab.title}
      variant="ghost"
      size="sm"
      className={`${badgePillClass} h-auto min-h-0`}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="max-w-24 truncate normal-case">{tab.title}</span>
    </Button>
  );
}

export function TitleBadgeRow({
  badges,
  tabs,
  isEditing,
  onSelectTab,
  onRemoveBadge,
  align = 'left',
}: {
  badges: TitleBadge[];
  tabs: DashboardTitleTabRef[];
  isEditing: boolean;
  onSelectTab?: (tabId: string) => void;
  onRemoveBadge?: (id: string) => void;
  align?: TitleAlign;
}) {
  const { t } = useTranslation();

  if (badges.length === 0) return null;

  const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div className={cn('flex w-full flex-wrap items-center gap-1.5', justifyClass)} onClick={(event) => event.stopPropagation()}>
      {badges.map((badge) => {
        const tab = badge.kind === 'tab' ? tabs.find((candidate) => candidate.id === badge.tabId) : undefined;
        if (badge.kind === 'tab' && !tab) return null;

        return (
          <span key={badge.id} className="relative inline-flex">
            {badge.kind === 'weather' ? <WeatherBadgeContent /> : null}
            {badge.kind === 'time' ? <TimeBadgeContent /> : null}
            {badge.kind === 'tab' && tab ? <TabBadgeContent tab={tab} onSelectTab={onSelectTab} /> : null}
            {isEditing && onRemoveBadge ? (
              <IconButton
                onClick={() => onRemoveBadge(badge.id)}
                icon={X}
                label={t('common.delete')}
                variant="danger"
                size="sm"
                className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full p-0 shadow"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
