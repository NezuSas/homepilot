import { useTranslation } from 'react-i18next';
import { IconPicker } from '../../views/dashboards/components/IconPicker';
import { Input } from '../ui/Input';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { SearchableSelectField } from '../ui/SearchableSelectField';
import type { ViewColumns } from './viewConfigModel';

interface DashboardViewSettingsTabProps {
  maxColumns: ViewColumns;
  draftTitle: string;
  iconQuery: string;
  routeSlug: string;
  isDefaultTab: boolean;
  /** Title of the view that currently owns the default flag, when it is not this one. */
  defaultTabOwnerTitle?: string;
  isCurrentDefault?: boolean;
  onMaxColumnsChange: (value: ViewColumns) => void;
  onTitleChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onDefaultChange: (value: boolean) => void;
}

export function DashboardViewSettingsTab({
  maxColumns,
  draftTitle,
  iconQuery,
  routeSlug,
  isDefaultTab,
  defaultTabOwnerTitle,
  isCurrentDefault,
  onMaxColumnsChange,
  onTitleChange,
  onIconChange,
  onDefaultChange,
}: DashboardViewSettingsTabProps) {
  const { t } = useTranslation();
  const defaultTakenByOther = Boolean(defaultTabOwnerTitle && !isCurrentDefault);

  return (
    <div className="space-y-5">
      <SearchableSelectField label={t('dashboards.edit_session.max_columns')} value={String(maxColumns)} options={[1, 2, 3, 4].map(value => ({ value: String(value), label: String(value) }))} onChange={value => onMaxColumnsChange(Number(value) as ViewColumns)} />
      <Input
        label={t('dashboards.view_config.view_title')}
        value={draftTitle}
        onChange={event => onTitleChange(event.target.value)}
      />

      <div className="rounded-xl bg-muted/45 px-4 py-3">
        {/* Shared picker: Home Assistant Material Design Icons + Lucide,
            same catalog and resolver used by dashboard cards. */}
        <IconPicker
          value={iconQuery}
          onChange={onIconChange}
          label={t('dashboards.view_config.icon')}
          placeholder={t('dashboards.view_config.icon_placeholder')}
        />
      </div>

      <Input
        label={t('dashboards.view_config.route_label')}
        value={routeSlug}
        readOnly
        helperText={t('dashboards.view_config.url_hint')}
      />

      <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-body font-bold text-foreground">{t('dashboards.view_config.default_view')}</span>
          <span className="mt-0.5 block text-caption text-muted-foreground">{t('dashboards.view_config.default_view_hint')}</span>
          {defaultTakenByOther && <span id="dashboard-default-tab-owner" className="mt-1 block text-caption text-muted-foreground">{t('dashboards.view_config.default_view_taken', { title: defaultTabOwnerTitle })}</span>}
        </span>
        <ToggleSwitch
          checked={isDefaultTab}
          onCheckedChange={onDefaultChange}
          label={t('dashboards.view_config.default_view')}
          disabled={defaultTakenByOther}
          aria-describedby={defaultTakenByOther ? 'dashboard-default-tab-owner' : undefined}
          size="sm"
        />
      </div>
    </div>
  );
}
