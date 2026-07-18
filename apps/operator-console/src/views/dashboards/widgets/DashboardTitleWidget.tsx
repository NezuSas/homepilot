import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateId } from '../../../utils/generateId';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { getDashboardIconComponent, useMdiCatalogLoaded } from '../components/IconPicker';
import { formatTemperature, getClockLocale, isDaytimeHour } from './clock/clockUtils';
import { getWeatherCategory, WeatherScene } from './clock/designs/WeatherScene';
import { useCuencaWeather } from './clock/useCuencaWeather';
import type { DashboardWidgetConfig } from '../types';

interface DashboardTitleTabRef {
  id: string;
  title: string;
  icon?: string;
}

interface DashboardTitleWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  isSelected?: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
  /** Other tabs of this dashboard, so a badge can jump straight to one of them. */
  tabs?: DashboardTitleTabRef[];
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

type TitleAlign = 'left' | 'center' | 'right';
type TitleWidthMode = 'full' | 'half' | 'third';

interface TitleBadge {
  id: string;
  kind: 'weather' | 'time' | 'tab';
  tabId?: string;
}

function parseBadges(value: unknown): TitleBadge[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TitleBadge => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.id === 'string' && (record.kind === 'weather' || record.kind === 'time' || record.kind === 'tab');
  });
}

function getStoredUserName() {
  if (typeof window === 'undefined') return 'Usuario';

  type Candidate = { value: string; score: number };
  const candidates: Candidate[] = [];
  const storages = [window.sessionStorage, window.localStorage];

  const looksLikeToken = (value: string) => {
    const clean = value.trim();
    if (clean.includes('.') && clean.split('.').length >= 3) return true;
    if (clean.length > 28 && /^[A-Za-z0-9_-]+$/.test(clean)) return true;
    if (clean.length > 20 && /[A-Z]/.test(clean) && /[a-z]/.test(clean) && /\d/.test(clean)) return true;
    return false;
  };

  const normalizeName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > 80 || looksLikeToken(clean)) return null;
    return clean.includes('@') ? clean.split('@')[0] : clean;
  };

  const addCandidate = (value: unknown, score: number) => {
    const normalized = normalizeName(value);
    if (!normalized) return;
    candidates.push({
      value: normalized,
      score: normalized.toLowerCase() === 'gustavo' ? score - 80 : score,
    });
  };

  const readNameFromObject = (input: unknown): string | null => {
    if (!input || typeof input !== 'object') return null;

    const stack: unknown[] = [input];
    const seen = new Set<unknown>();

    while (stack.length) {
      const current = stack.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);

      const record = current as Record<string, unknown>;
      const direct =
        record.name ||
        record.displayName ||
        record.fullName ||
        record.firstName ||
        record.username ||
        record.userName ||
        record.email;

      const normalized = normalizeName(direct);
      if (normalized) return normalized;

      for (const value of Object.values(record)) {
        if (value && typeof value === 'object') stack.push(value);
      }
    }

    return null;
  };

  const readJwtPayload = (value: string) => {
    const payload = value.split('.')[1];
    if (!payload) return null;

    try {
      return JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  };

  for (const storage of storages) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || '';
      const raw = storage.getItem(key);
      if (!raw) continue;

      const lowerKey = key.toLowerCase();
      const isLikelyAuth = ['auth', 'session', 'current', 'profile', 'account', 'user', 'token', 'operator'].some((part) => lowerKey.includes(part));
      if (!isLikelyAuth) continue;

      const score =
        lowerKey.includes('profile') ? 105 :
        lowerKey.includes('account') ? 100 :
        lowerKey.includes('current') ? 95 :
        lowerKey.includes('session') ? 90 :
        lowerKey.includes('auth') ? 85 :
        lowerKey.includes('operator') ? 75 :
        lowerKey.includes('user') ? 60 :
        lowerKey.includes('token') ? 45 :
        20;

      const jwtPayload = readJwtPayload(raw);
      if (jwtPayload) addCandidate(readNameFromObject(jwtPayload), score + 20);

      try {
        addCandidate(readNameFromObject(JSON.parse(raw)), score);
      } catch {
        if (!lowerKey.includes('token') && !lowerKey.includes('session') && !lowerKey.includes('auth')) {
          addCandidate(raw, score - 30);
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value || 'Usuario';
}

function renderTemplate(markdown: string) {
  const user = getStoredUserName();

  return markdown
    .replace(/\{\{\s*user\s*\}\}/gi, user)
    .replace(/\{\{\s*usuario\s*\}\}/gi, user);
}

function markdownToBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);

  return lines.map((rawLine, index) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      return { key: index, type: 'space' as const, text: '' };
    }

    if (line.startsWith('### ')) {
      return { key: index, type: 'h3' as const, text: line.slice(4).trim() };
    }

    if (line.startsWith('## ')) {
      return { key: index, type: 'h2' as const, text: line.slice(3).trim() };
    }

    if (line.startsWith('# ')) {
      return { key: index, type: 'h1' as const, text: line.slice(2).trim() };
    }

    return { key: index, type: 'p' as const, text: line.trim() };
  });
}

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
  useMdiCatalogLoaded();
  const Icon = tab.icon ? getDashboardIconComponent(tab.icon) : null;

  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onSelectTab?.(tab.id); }}
      className={badgePillClass}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="max-w-24 truncate normal-case">{tab.title}</span>
    </button>
  );
}

function TitleBadgeRow({
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
              <button
                type="button"
                onClick={() => onRemoveBadge(badge.id)}
                className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-destructive-foreground shadow"
                aria-label="Remove badge"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function DashboardTitleWidget({ config, isEditing, isSelected = false, onUpdate, tabs = [], currentTabId, onSelectTab }: DashboardTitleWidgetProps) {
  const { t } = useTranslation();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const markdown =
    typeof config.extra?.markdown === 'string' && config.extra.markdown.trim()
      ? config.extra.markdown
      : [
          `# ${config.appearance?.title || t('dashboard.editor.sections.title_placeholder')}`,
          typeof config.extra?.subtitle === 'string'
            ? config.extra.subtitle
            : t('dashboard.editor.sections.subtitle_placeholder'),
        ].filter(Boolean).join('\n');

  const align = (config.extra?.align === 'left' || config.extra?.align === 'right' || config.extra?.align === 'center')
    ? config.extra.align as TitleAlign
    : 'center';

  const widthMode = (config.extra?.widthMode === 'half' || config.extra?.widthMode === 'third')
    ? config.extra.widthMode as TitleWidthMode
    : 'full';

  const blockAlign = (config.extra?.blockAlign === 'left' || config.extra?.blockAlign === 'right' || config.extra?.blockAlign === 'center')
    ? config.extra.blockAlign as TitleAlign
    : 'center';

  const setAlign = (value: TitleAlign) => onUpdate?.({ extra: { ...config.extra, align: value } });
  const setWidthMode = (value: TitleWidthMode) => onUpdate?.({ extra: { ...config.extra, widthMode: value } });
  const setBlockAlign = (value: TitleAlign) => onUpdate?.({ extra: { ...config.extra, blockAlign: value } });

  const badges = useMemo(() => parseBadges(config.extra?.badges), [config.extra?.badges]);
  const hasWeatherBadge = badges.some((badge) => badge.kind === 'weather');
  const hasTimeBadge = badges.some((badge) => badge.kind === 'time');
  const linkableTabs = tabs.filter((candidate) => candidate.id !== currentTabId);
  const availableTabsForBadge = linkableTabs.filter(
    (candidate) => !badges.some((badge) => badge.kind === 'tab' && badge.tabId === candidate.id),
  );

  // Badges always sit in their own row at the bottom, full width; only their
  // horizontal position within that row is configurable.
  const badgeAlign = (config.extra?.badgeAlign === 'left' || config.extra?.badgeAlign === 'right' || config.extra?.badgeAlign === 'center')
    ? config.extra.badgeAlign as TitleAlign
    : 'left';
  const setBadgeAlign = (value: TitleAlign) => onUpdate?.({ extra: { ...config.extra, badgeAlign: value } });

  const setBadges = (next: TitleBadge[]) => onUpdate?.({ extra: { ...config.extra, badges: next } });
  const toggleWeatherBadge = () => setBadges(
    hasWeatherBadge ? badges.filter((badge) => badge.kind !== 'weather') : [...badges, { id: generateId(), kind: 'weather' as const }],
  );
  const toggleTimeBadge = () => setBadges(
    hasTimeBadge ? badges.filter((badge) => badge.kind !== 'time') : [...badges, { id: generateId(), kind: 'time' as const }],
  );
  const addTabBadge = (tabId: string) => setBadges([...badges, { id: generateId(), kind: 'tab' as const, tabId }]);
  const removeBadge = (id: string) => setBadges(badges.filter((badge) => badge.id !== id));

  const rendered = useMemo(() => renderTemplate(markdown), [markdown]);
  const blocks = useMemo(() => markdownToBlocks(rendered), [rendered]);
  const [draftMarkdown, setDraftMarkdown] = useState(markdown);

  useEffect(() => {
    setDraftMarkdown(markdown);
  }, [markdown]);

  useEffect(() => {
    if (isEditing && isSelected) setIsEditorOpen(true);
  }, [isEditing, isSelected]);

  const alignmentClass = align === 'left'
    ? 'items-start text-left'
    : align === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';

  const widthClass = widthMode === 'half' ? 'w-1/2' : widthMode === 'third' ? 'w-1/3' : 'w-full';
  const blockJustifyClass = blockAlign === 'left' ? 'justify-start' : blockAlign === 'right' ? 'justify-end' : 'justify-center';

  if (isEditing && !markdown.trim()) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-section border-2 border-dashed border-border/60 bg-background/10 px-5 py-4">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-body font-semibold text-primary">
          <span className="text-panel-title leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full w-full', blockJustifyClass)}>
    <div
      className={cn(
        'flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-section border border-border/35 bg-background/10 px-widget-pad-x py-widget-pad-y',
        widthClass,
        alignmentClass,
      )}
      style={{ containerType: 'inline-size' }}
      onClick={() => {
        // Reopening only relied on `isSelected` flipping false -> true, so a
        // second click on an already-selected title (selection never cleared
        // after the first save) silently did nothing. Open directly on click
        // instead, regardless of prior selection state.
        if (isEditing && !isEditorOpen) setIsEditorOpen(true);
      }}
    >
      {isEditing && isEditorOpen ? (
        <form
          className="flex h-full w-full min-w-0 flex-col justify-center gap-2"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate?.({
              extra: {
                ...config.extra,
                markdown: draftMarkdown.trim() || markdown,
              },
            });
            setIsEditorOpen(false);
          }}
        >
          <label className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="dashboard-title-markdown">
            {t('dashboard.editor.sections.title_markdown')}
          </label>
          <textarea
            id="dashboard-title-markdown"
            value={draftMarkdown}
            onChange={(event) => setDraftMarkdown(event.target.value)}
            className="min-h-16 w-full resize-none rounded-field border border-border bg-background/85 px-3 py-2 text-body leading-snug text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label={t('dashboard.editor.sections.title_markdown')}
          />

          <div className="flex flex-wrap items-center gap-3">
            <TitleOptionGroup
              label={t('dashboard.editor.sections.title_alignment')}
              value={align}
              onChange={setAlign}
              options={[
                { value: 'left', icon: AlignLeft, label: t('dashboard.editor.sections.align_left') },
                { value: 'center', icon: AlignCenter, label: t('dashboard.editor.sections.align_center') },
                { value: 'right', icon: AlignRight, label: t('dashboard.editor.sections.align_right') },
              ]}
            />

            <TitleOptionGroup
              label={t('dashboard.editor.sections.title_width')}
              value={widthMode}
              onChange={setWidthMode}
              options={[
                { value: 'full', label: t('dashboard.editor.sections.width_full') },
                { value: 'half', label: t('dashboard.editor.sections.width_half') },
                { value: 'third', label: t('dashboard.editor.sections.width_third') },
              ]}
            />

            {widthMode !== 'full' && (
              <TitleOptionGroup
                label={t('dashboard.editor.sections.title_position')}
                value={blockAlign}
                onChange={setBlockAlign}
                options={[
                  { value: 'left', icon: AlignHorizontalJustifyStart, label: t('dashboard.editor.sections.align_left') },
                  { value: 'center', icon: AlignHorizontalJustifyCenter, label: t('dashboard.editor.sections.align_center') },
                  { value: 'right', icon: AlignHorizontalJustifyEnd, label: t('dashboard.editor.sections.align_right') },
                ]}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t('dashboard.editor.sections.title_badges')}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={toggleWeatherBadge}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-caption font-semibold transition',
                  hasWeatherBadge ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t('dashboard.editor.sections.badge_weather')}
              </button>
              <button
                type="button"
                onClick={toggleTimeBadge}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-caption font-semibold transition',
                  hasTimeBadge ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t('dashboard.editor.sections.badge_time')}
              </button>

              {badges.filter((badge) => badge.kind === 'tab').map((badge) => {
                const linkedTab = linkableTabs.find((candidate) => candidate.id === badge.tabId);
                return (
                  <span
                    key={badge.id}
                    className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-caption font-semibold text-primary"
                  >
                    {linkedTab?.title ?? badge.tabId}
                    <button type="button" onClick={() => removeBadge(badge.id)} aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}

              {availableTabsForBadge.length > 0 && (
                <SearchableSelectField
                  value=""
                  onChange={(value) => { if (value) addTabBadge(value); }}
                  options={availableTabsForBadge.map((candidate) => ({ value: candidate.id, label: candidate.title }))}
                  placeholder={t('dashboard.editor.sections.badge_add_tab')}
                  size="small"
                  fullWidth={false}
                  className="w-auto"
                />
              )}
            </div>

            {badges.length > 0 && (
              <TitleOptionGroup
                label={t('dashboard.editor.sections.badge_position')}
                value={badgeAlign}
                onChange={setBadgeAlign}
                options={[
                  { value: 'left', icon: AlignHorizontalJustifyStart, label: t('dashboard.editor.sections.align_left') },
                  { value: 'center', icon: AlignHorizontalJustifyCenter, label: t('dashboard.editor.sections.align_center') },
                  { value: 'right', icon: AlignHorizontalJustifyEnd, label: t('dashboard.editor.sections.align_right') },
                ]}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftMarkdown(markdown);
                setIsEditorOpen(false);
              }}
              className="rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-muted-foreground transition hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-button bg-primary px-3 py-1.5 text-caption font-semibold text-primary-foreground transition hover:bg-primary/90">
              {t('common.save')}
            </button>
          </div>
        </form>
      ) : (
      <div className="min-w-0 max-w-full space-y-[clamp(0.18rem,0.6cqi,0.45rem)]">
        {blocks.map((block) => {
          if (block.type === 'space') {
            return <div key={block.key} className="h-widget-spacer" />;
          }

          if (block.type === 'h1') {
            return (
              <h1
                key={block.key}
                className="min-w-0 max-w-full truncate text-widget-title-fluid font-black leading-tight tracking-tight text-foreground"
              >
                {block.text}
              </h1>
            );
          }

          if (block.type === 'h2') {
            return (
              <h2
                key={block.key}
                className="min-w-0 max-w-full truncate text-widget-title-compact-fluid font-black leading-tight tracking-tight text-foreground"
              >
                {block.text}
              </h2>
            );
          }

          if (block.type === 'h3') {
            return (
              <h3
                key={block.key}
                className="min-w-0 max-w-full truncate text-widget-title-small-fluid font-bold leading-tight text-foreground"
              >
                {block.text}
              </h3>
            );
          }

          return (
            <p
              key={block.key}
              className="min-w-0 max-w-full truncate text-widget-caption-fluid font-medium leading-snug text-muted-foreground"
            >
              {block.text}
            </p>
          );
        })}
        <TitleBadgeRow
          badges={badges}
          tabs={linkableTabs}
          isEditing={isEditing}
          onSelectTab={onSelectTab}
          onRemoveBadge={removeBadge}
          align={badgeAlign}
        />
      </div>
      )}
    </div>
    </div>
  );
}

/** Small segmented control used for text alignment / width / block position pickers. */
function TitleOptionGroup<TValue extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: Array<{ value: TValue; label: string; icon?: ComponentType<{ className?: string }> }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              onClick={(event) => { event.stopPropagation(); onChange(option.value); }}
              className={cn(
                'grid h-8 place-items-center rounded text-micro font-black transition-colors',
                Icon ? 'w-8' : 'px-2.5',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
