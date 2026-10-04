import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateId } from '../../../utils/generateId';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Textarea } from '../../../components/ui/Textarea';
import { TitleBadgeRow } from './DashboardTitleBadges';
import { markdownToBlocks, parseBadges, renderTemplate, type DashboardTitleWidgetProps, type TitleAlign, type TitleBadge, type TitleWidthMode } from './dashboardTitleContent';

export function DashboardTitleWidget({ config, isEditing, isSelected = false, editRequest = 0, onEditorOpenChange, onUpdate, tabs = [], currentTabId, onSelectTab }: DashboardTitleWidgetProps) {
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
  const removeBadge = (id: string) => setBadges(badges.filter((badge) => badge.id !== id));

  const rendered = useMemo(() => renderTemplate(markdown, t('dashboard.user_fallback')), [markdown, t]);
  const blocks = useMemo(() => markdownToBlocks(rendered), [rendered]);
  const [draftMarkdown, setDraftMarkdown] = useState(markdown);

  useEffect(() => {
    setDraftMarkdown(markdown);
  }, [markdown]);

  useEffect(() => {
    if (isEditing && isSelected) setIsEditorOpen(true);
  }, [isEditing, isSelected]);

  useEffect(() => {
    if (isEditing && editRequest > 0) setIsEditorOpen(true);
  }, [editRequest, isEditing]);

  useEffect(() => {
    onEditorOpenChange?.(isEditorOpen);
  }, [isEditorOpen, onEditorOpenChange]);

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
        'homepilot-dashboard-title flex h-full min-w-0 flex-col justify-center overflow-hidden px-widget-pad-x py-widget-pad-y',
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
          <Textarea
            id="dashboard-title-markdown"
            label={t('dashboard.editor.sections.title_markdown')}
            value={draftMarkdown}
            onChange={(event) => setDraftMarkdown(event.target.value)}
            className="min-h-16 resize-none rounded-field bg-background/85 leading-snug text-foreground"
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
            <span className="text-micro font-semibold uppercase tracking-label-wider text-muted-foreground">
              {t('dashboard.editor.sections.title_badges')}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {hasWeatherBadge && <Button
                type="button"
                onClick={toggleWeatherBadge}
                variant={hasWeatherBadge ? 'primary' : 'outline'}
                size="xs"
                className={cn(
                  'rounded-full',
                  hasWeatherBadge ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t('dashboard.editor.sections.badge_weather')}
              </Button>}
              {hasTimeBadge && <Button
                type="button"
                onClick={toggleTimeBadge}
                variant={hasTimeBadge ? 'primary' : 'outline'}
                size="xs"
                className={cn(
                  'rounded-full',
                  hasTimeBadge ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t('dashboard.editor.sections.badge_time')}
              </Button>}

              {badges.filter((badge) => badge.kind === 'tab').map((badge) => {
                const linkedTab = linkableTabs.find((candidate) => candidate.id === badge.tabId);
                return (
                  <span
                    key={badge.id}
                    className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-caption font-semibold text-primary"
                  >
                    {linkedTab?.title ?? badge.tabId}
                    <IconButton
                      icon={X}
                      label={t('common.delete')}
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBadge(badge.id)}
                      className="h-4 w-4 rounded-full p-0 text-primary hover:bg-primary/15 hover:text-primary"
                    />
                  </span>
                );
              })}


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
            <Button
              type="button"
              onClick={() => {
                setDraftMarkdown(markdown);
                setIsEditorOpen(false);
              }}
              variant="outline"
              size="sm"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm">
              {t('common.save')}
            </Button>
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
  options: Array<{ value: TValue; label: string; icon?: LucideIcon }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro font-semibold uppercase tracking-label-wider text-muted-foreground">{label}</span>
      <div onClick={(event) => event.stopPropagation()}>
        <SegmentedControl
          value={value}
          options={options}
          onChange={onChange}
          label={label}
          className="gap-0.5 rounded-lg border-0 bg-muted/40 p-0.5"
          optionClassName="min-h-8 min-w-8 flex-none rounded px-2 py-1 text-micro font-black"
        />
      </div>
    </div>
  );
}
