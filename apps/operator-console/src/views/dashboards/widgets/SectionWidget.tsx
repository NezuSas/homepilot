import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const { t } = useTranslation();

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;

  if (!isEditing) {
    return (
      <section className="flex h-full w-full min-w-0 items-end px-1 pb-2">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.3rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}
      </section>
    );
  }

  return (
    <div className="group/section flex h-full w-full min-w-0 flex-col rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
      <div className="min-w-0">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(0.85rem,1.65cqi,1rem)] font-semibold text-foreground">
            {title}
          </h2>
        ) : (
          <span className="text-[clamp(0.72rem,1.35cqi,0.85rem)] font-semibold text-muted-foreground">
            {t('dashboard.editor.sections.untitled_section')}
          </span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 group-hover/section:bg-primary/10">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}