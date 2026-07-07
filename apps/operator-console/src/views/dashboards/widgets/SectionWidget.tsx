import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const title = config.appearance?.title || 'Sección';

  return (
    <div className="flex h-full w-full items-end pb-2 px-1">
      <div className="flex w-full items-center gap-3">
        <span
          className="text-xs font-black uppercase tracking-[0.2em] text-foreground/70 whitespace-nowrap"
        >
          {title}
        </span>
        <div className="h-px flex-1 bg-border/50" />
        {isEditing && (
          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30 shrink-0">
            sección
          </span>
        )}
      </div>
    </div>
  );
}
