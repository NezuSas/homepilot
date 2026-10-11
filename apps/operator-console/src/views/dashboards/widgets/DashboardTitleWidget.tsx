import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { generateId } from '../../../utils/generateId';
import { TitleBadgeRow } from './DashboardTitleBadges';
import { DashboardTitleBlocks } from './DashboardTitleBlocks';
import { DashboardTitleEditorForm } from './DashboardTitleEditorForm';
import { markdownToBlocks, parseBadges, renderTemplate, type DashboardTitleWidgetProps, type TitleAlign, type TitleBadge, type TitleWidthMode } from './dashboardTitleContent';
import { getTitleLayoutClasses, readTitleAlign, readTitleWidthMode, resolveTitleMarkdown } from './dashboardTitleSettings';
import { useTitleEditorState } from './useTitleEditorState';

export function DashboardTitleWidget({ config, isEditing, isSelected = false, editRequest = 0, onEditorOpenChange, onUpdate, tabs = [], currentTabId, onSelectTab }: DashboardTitleWidgetProps) {
  const { t } = useTranslation();

  const markdown = resolveTitleMarkdown(
    config.extra,
    config.appearance?.title,
    t('dashboard.editor.sections.title_placeholder'),
    t('dashboard.editor.sections.subtitle_placeholder'),
  );

  const align = readTitleAlign(config.extra?.align, 'center');
  const widthMode = readTitleWidthMode(config.extra?.widthMode);
  const blockAlign = readTitleAlign(config.extra?.blockAlign, 'center');

  const setAlign = (value: TitleAlign) => onUpdate?.({ extra: { ...config.extra, align: value } });
  const setWidthMode = (value: TitleWidthMode) => onUpdate?.({ extra: { ...config.extra, widthMode: value } });
  const setBlockAlign = (value: TitleAlign) => onUpdate?.({ extra: { ...config.extra, blockAlign: value } });

  const badges = useMemo(() => parseBadges(config.extra?.badges), [config.extra?.badges]);
  const hasWeatherBadge = badges.some((badge) => badge.kind === 'weather');
  const hasTimeBadge = badges.some((badge) => badge.kind === 'time');
  const linkableTabs = tabs.filter((candidate) => candidate.id !== currentTabId);

  // Badges always sit in their own row at the bottom, full width; only their
  // horizontal position within that row is configurable.
  const badgeAlign = readTitleAlign(config.extra?.badgeAlign, 'left');
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
  const { isEditorOpen, setIsEditorOpen, draftMarkdown, setDraftMarkdown } = useTitleEditorState({
    markdown, isEditing, isSelected, editRequest, onEditorOpenChange,
  });

  const { alignmentClass, widthClass, blockJustifyClass } = getTitleLayoutClasses(align, widthMode, blockAlign);

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
        <DashboardTitleEditorForm
          draftMarkdown={draftMarkdown}
          onDraftChange={setDraftMarkdown}
          align={align}
          onAlignChange={setAlign}
          widthMode={widthMode}
          onWidthModeChange={setWidthMode}
          blockAlign={blockAlign}
          onBlockAlignChange={setBlockAlign}
          badgeAlign={badgeAlign}
          onBadgeAlignChange={setBadgeAlign}
          badges={badges}
          linkableTabs={linkableTabs}
          hasWeatherBadge={hasWeatherBadge}
          hasTimeBadge={hasTimeBadge}
          onToggleWeatherBadge={toggleWeatherBadge}
          onToggleTimeBadge={toggleTimeBadge}
          onRemoveBadge={removeBadge}
          onSave={() => {
            onUpdate?.({
              extra: {
                ...config.extra,
                markdown: draftMarkdown.trim() || markdown,
              },
            });
            setIsEditorOpen(false);
          }}
          onCancel={() => {
            setDraftMarkdown(markdown);
            setIsEditorOpen(false);
          }}
        />
      ) : (
      <div className="min-w-0 max-w-full space-y-[clamp(0.18rem,0.6cqi,0.45rem)]">
        <DashboardTitleBlocks blocks={blocks} />
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
