import { useTranslation } from 'react-i18next';
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Textarea } from '../../../components/ui/Textarea';
import { TitleOptionGroup } from './TitleOptionGroup';
import type { DashboardTitleTabRef, TitleAlign, TitleBadge, TitleWidthMode } from './dashboardTitleContent';

interface DashboardTitleEditorFormProps {
  draftMarkdown: string;
  onDraftChange: (value: string) => void;
  align: TitleAlign;
  onAlignChange: (value: TitleAlign) => void;
  widthMode: TitleWidthMode;
  onWidthModeChange: (value: TitleWidthMode) => void;
  blockAlign: TitleAlign;
  onBlockAlignChange: (value: TitleAlign) => void;
  badgeAlign: TitleAlign;
  onBadgeAlignChange: (value: TitleAlign) => void;
  badges: TitleBadge[];
  linkableTabs: DashboardTitleTabRef[];
  hasWeatherBadge: boolean;
  hasTimeBadge: boolean;
  onToggleWeatherBadge: () => void;
  onToggleTimeBadge: () => void;
  onRemoveBadge: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DashboardTitleEditorForm({
  draftMarkdown, onDraftChange, align, onAlignChange, widthMode, onWidthModeChange, blockAlign, onBlockAlignChange,
  badgeAlign, onBadgeAlignChange, badges, linkableTabs, hasWeatherBadge, hasTimeBadge,
  onToggleWeatherBadge, onToggleTimeBadge, onRemoveBadge, onSave, onCancel,
}: DashboardTitleEditorFormProps) {
  const { t } = useTranslation();

  return (
    <form
      className="flex h-full w-full min-w-0 flex-col justify-center gap-2"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <Textarea
        id="dashboard-title-markdown"
        label={t('dashboard.editor.sections.title_markdown')}
        value={draftMarkdown}
        onChange={(event) => onDraftChange(event.target.value)}
        className="min-h-16 resize-none rounded-field bg-background/85 leading-snug text-foreground"
        aria-label={t('dashboard.editor.sections.title_markdown')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <TitleOptionGroup
          label={t('dashboard.editor.sections.title_alignment')}
          value={align}
          onChange={onAlignChange}
          options={[
            { value: 'left', icon: AlignLeft, label: t('dashboard.editor.sections.align_left') },
            { value: 'center', icon: AlignCenter, label: t('dashboard.editor.sections.align_center') },
            { value: 'right', icon: AlignRight, label: t('dashboard.editor.sections.align_right') },
          ]}
        />

        <TitleOptionGroup
          label={t('dashboard.editor.sections.title_width')}
          value={widthMode}
          onChange={onWidthModeChange}
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
            onChange={onBlockAlignChange}
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
            onClick={onToggleWeatherBadge}
            variant={hasWeatherBadge ? 'primary' : 'outline'}
            size="xs"
          >
            {t('dashboard.editor.sections.badge_weather')}
          </Button>}
          {hasTimeBadge && <Button
            type="button"
            onClick={onToggleTimeBadge}
            variant={hasTimeBadge ? 'primary' : 'outline'}
            size="xs"
          >
            {t('dashboard.editor.sections.badge_time')}
          </Button>}

          {badges.filter((badge) => badge.kind === 'tab').map((badge) => {
            const linkedTab = linkableTabs.find((candidate) => candidate.id === badge.tabId);
            return (
              <StatusPill key={badge.id} variant="primary" size="lg" className="border-primary">
                {linkedTab?.title ?? badge.tabId}
                <IconButton
                  icon={X}
                  label={t('common.delete')}
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveBadge(badge.id)}
                  className="text-primary hover:bg-primary/15 hover:text-primary"
                />
              </StatusPill>
            );
          })}
        </div>

        {badges.length > 0 && (
          <TitleOptionGroup
            label={t('dashboard.editor.sections.badge_position')}
            value={badgeAlign}
            onChange={onBadgeAlignChange}
            options={[
              { value: 'left', icon: AlignHorizontalJustifyStart, label: t('dashboard.editor.sections.align_left') },
              { value: 'center', icon: AlignHorizontalJustifyCenter, label: t('dashboard.editor.sections.align_center') },
              { value: 'right', icon: AlignHorizontalJustifyEnd, label: t('dashboard.editor.sections.align_right') },
            ]}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" onClick={onCancel} variant="outline" size="sm">
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
