import React from 'react';
import { Check } from 'lucide-react';
import type { WidgetType } from '../views/dashboards/types';

interface DashboardEditorToolbarProps {
  title: string;
  doneLabel: string;
  addWidgetLabel: (type: WidgetType) => string;
  onDone: () => void;
  onAddWidget: (type: WidgetType) => void;
}

const WIDGET_TYPES: WidgetType[] = [
  'device_control',
  'room_overview',
  'scene_shortcut',
  'activity_feed',
  'assistant_insight',
  'system_status'
];

export const DashboardEditorToolbar: React.FC<DashboardEditorToolbarProps> = ({
  title,
  doneLabel,
  addWidgetLabel,
  onDone,
  onAddWidget
}) => (
  <div className="mx-auto w-full max-w-4xl animate-in fade-in slide-in-from-top-3 duration-300">
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
        {WIDGET_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onAddWidget(type)}
            className="shrink-0 px-4 py-2 bg-card border border-border/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
          >
            + {addWidgetLabel(type)}
          </button>
        ))}
      </div>
    </div>
  </div>
);
