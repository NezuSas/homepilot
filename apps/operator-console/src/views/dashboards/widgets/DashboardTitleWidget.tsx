import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface DashboardTitleWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function DashboardTitleWidget({ config, isEditing }: DashboardTitleWidgetProps) {
  const { t } = useTranslation();

  const title = config.appearance?.title?.trim();
  const subtitle = typeof config.extra?.subtitle === 'string' ? config.extra.subtitle.trim() : '';

  if (isEditing && !title && !subtitle) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-border/60 bg-background/10 px-6 py-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col items-center justify-center rounded-[1.5rem] border border-border/35 bg-background/10 px-[clamp(1rem,3cqi,2rem)] py-[clamp(1rem,2cqi,1.5rem)] text-center">
      {title ? (
        <h1 className="min-w-0 max-w-full truncate text-[clamp(1.45rem,3.2cqi,2.4rem)] font-black tracking-tight text-foreground">
          {title}
        </h1>
      ) : isEditing ? (
        <span className="text-sm font-semibold text-muted-foreground">
          {t('dashboard.editor.sections.title_area')}
        </span>
      ) : null}

      {subtitle ? (
        <p className="mt-3 min-w-0 max-w-3xl truncate text-[clamp(0.85rem,1.5cqi,1rem)] font-medium text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}