import { Plus } from 'lucide-react';
import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const title = config.appearance?.title || 'Nueva sección';
  const showTitle = config.appearance?.showTitle !== false;

  if (!isEditing) {
    return (
      <section className="flex h-full w-full min-w-0 items-end px-1 pb-2">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.35rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}
      </section>
    );
  }

  return (
    <div className="group/section flex h-full w-full min-w-0 flex-col justify-between rounded-[1.35rem] border-2 border-dashed border-border/70 bg-background/20 px-[clamp(0.85rem,2cqi,1.25rem)] py-[clamp(0.75rem,1.7cqi,1rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
      <div className="min-w-0">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(0.95rem,1.9cqi,1.2rem)] font-semibold text-foreground">
            {title}
          </h2>
        ) : (
          <span className="text-[clamp(0.75rem,1.5cqi,0.9rem)] font-semibold text-muted-foreground">
            Sección sin título
          </span>
        )}
      </div>

      <div className="mt-3 inline-flex h-11 min-w-20 items-center justify-center self-start rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 text-primary transition-all duration-200 group-hover/section:bg-primary/10">
        <Plus className="h-5 w-5" />
      </div>
    </div>
  );
}