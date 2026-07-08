import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const title = config.appearance?.title || 'SecciÃ³n';

  return (
    <div className="flex h-full w-full items-end pb-3 px-2 select-none">
      <div className="flex w-full items-center justify-between">
        <span
          className="truncate text-[11px] @md:text-[13px] font-black uppercase tracking-[0.18em] @md:tracking-[0.25em] text-foreground/80 whitespace-nowrap"
        >
          {title}
        </span>
        {isEditing && (
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/35 shrink-0 bg-muted/30 px-2 py-0.5 rounded-md">
            secciÃ³n
          </span>
        )}
      </div>
    </div>
  );
}
