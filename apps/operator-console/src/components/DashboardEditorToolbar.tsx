import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { WidgetType } from '../views/dashboards/types';
import type { WidgetLayout } from '../views/dashboards/types';
import { cn } from '../lib/utils';

interface DashboardEditorToolbarProps {
  title: string;
  doneLabel: string;
  addWidgetLabel: (type: WidgetType) => string;
  onDone: () => void;
  onAddWidget: (type: WidgetType, layout: Pick<WidgetLayout, 'w' | 'h'>) => void;
}

interface WidgetDef {
  type: WidgetType;
  icon: string;
  defaultSize: Pick<WidgetLayout, 'w' | 'h'>;
}

const SIZE_PRESETS = [
  { label: 'S',  w: 2, h: 3 },
  { label: 'M',  w: 4, h: 4 },
  { label: 'L',  w: 6, h: 4 },
  { label: 'XL', w: 8, h: 5 },
] as const;

const WIDGET_DEFS: WidgetDef[] = [
  { type: 'device_control',   icon: '💡', defaultSize: { w: 4, h: 4 } },
  { type: 'room_overview',    icon: '🏠', defaultSize: { w: 6, h: 4 } },
  { type: 'scene_shortcut',   icon: '🎬', defaultSize: { w: 3, h: 3 } },
  { type: 'activity_feed',    icon: '📋', defaultSize: { w: 4, h: 6 } },
  { type: 'assistant_insight',icon: '🤖', defaultSize: { w: 6, h: 4 } },
  { type: 'system_status',    icon: '📡', defaultSize: { w: 4, h: 4 } },
  { type: 'clock_display',    icon: '🕐', defaultSize: { w: 4, h: 4 } },
  { type: 'section',          icon: '─',  defaultSize: { w: 12, h: 2 } },
];

export const DashboardEditorToolbar: React.FC<DashboardEditorToolbarProps> = ({
  title,
  doneLabel,
  addWidgetLabel,
  onDone,
  onAddWidget,
}) => {
  const [openMenu, setOpenMenu] = useState<WidgetType | null>(null);

  const handleAdd = (type: WidgetType, size: Pick<WidgetLayout, 'w' | 'h'>) => {
    setOpenMenu(null);
    onAddWidget(type, size);
  };

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col gap-3 rounded-panel border border-primary/20 bg-card/90 p-4 shadow-depth-2 backdrop-blur-xl">
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{title}</p>
          <button
            onClick={onDone}
            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50"
          >
            {doneLabel} <Check className="w-3 h-3" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pb-1">
          {WIDGET_DEFS.map(def => (
            <div key={def.type} className="relative">
              {/* Main add button */}
              <div className="flex overflow-hidden rounded-xl border border-border/80 shadow-sm">
                <button
                  onClick={() => handleAdd(def.type, def.defaultSize)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-primary/5 hover:border-primary/40 hover:text-primary text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  <span className="text-sm leading-none">{def.icon}</span>
                  + {addWidgetLabel(def.type)}
                </button>

                {/* Size picker toggle */}
                <button
                  onClick={() => setOpenMenu(openMenu === def.type ? null : def.type)}
                  className={cn(
                    "flex items-center px-2 border-l border-border/60 bg-card hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary",
                    openMenu === def.type && "bg-primary/10 text-primary"
                  )}
                  aria-label="Tamaño"
                >
                  <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", openMenu === def.type && "rotate-180")} />
                </button>
              </div>

              {/* Size preset dropdown */}
              {openMenu === def.type && (
                <div className="absolute top-full mt-1 left-0 z-50 flex gap-1 rounded-xl border border-border/80 bg-card/95 backdrop-blur-xl p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                  {SIZE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => handleAdd(def.type, { w: preset.w, h: preset.h })}
                      className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <span className="text-[11px] font-black uppercase tracking-widest">{preset.label}</span>
                      <span className="text-[8px] text-muted-foreground/50 tabular-nums">{preset.w}×{preset.h}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
