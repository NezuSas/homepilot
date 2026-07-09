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
      <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border-2 border-dashed border-border/60 bg-background/10 px-6 py-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/35 bg-background/10 px-[clamp(1rem,3cqi,2rem)] py-[clamp(0.85rem,1.8cqi,1.25rem)] text-center">
      {title ? (
        <h1 className="min-w-0 max-w-full truncate text-[clamp(1.35rem,3cqi,2.25rem)] font-black tracking-tight text-foreground">
          {title}
        </h1>
      ) : isEditing ? (
        <span className="text-sm font-semibold text-muted-foreground">
          {t('dashboard.editor.sections.title_area')}
        </span>
      ) : null}

      {subtitle ? (
        <p className="mt-2 min-w-0 max-w-3xl truncate text-[clamp(0.8rem,1.4cqi,0.95rem)] font-medium text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}