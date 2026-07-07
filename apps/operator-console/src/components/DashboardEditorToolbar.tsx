import React, { useState } from 'react';
import { Plus, X, ArrowUpRight } from 'lucide-react';
import type { WidgetType, WidgetLayout } from '../views/dashboards/types';
import { cn } from '../lib/utils';

interface DashboardEditorToolbarProps {
  title: string;
  doneLabel: string;
  addWidgetLabel: (type: WidgetType) => string;
  onDone: () => void;
  onAddWidget: (type: WidgetType, layout: Pick<WidgetLayout, 'w' | 'h'>) => void;
}

interface CardCatalogItem {
  type: WidgetType;
  title: string;
  desc: string;
  icon: string;
  iconBg: string;
  defaultSize: Pick<WidgetLayout, 'w' | 'h'>;
  sizeLabel: string;
}

const CATALOG_ITEMS: CardCatalogItem[] = [
  {
    type: 'device_control',
    title: 'Dispositivo',
    desc: 'Controla luces, interruptores y cámaras IP directamente.',
    icon: '💡',
    iconBg: 'bg-amber-500/10 text-amber-500',
    defaultSize: { w: 4, h: 4 },
    sizeLabel: 'Mediano (4×4)',
  },
  {
    type: 'room_overview',
    title: 'Habitación',
    desc: 'Visualiza el resumen y estado general de un cuarto.',
    icon: '🏠',
    iconBg: 'bg-emerald-500/10 text-emerald-500',
    defaultSize: { w: 6, h: 4 },
    sizeLabel: 'Grande (6×4)',
  },
  {
    type: 'scene_shortcut',
    title: 'Escena',
    desc: 'Acceso rápido para activar rutinas y ambientes.',
    icon: '🎬',
    iconBg: 'bg-indigo-500/10 text-indigo-500',
    defaultSize: { w: 3, h: 3 },
    sizeLabel: 'Pequeño (3×3)',
  },
  {
    type: 'activity_feed',
    title: 'Historial',
    desc: 'Línea de tiempo de eventos y alertas del hogar.',
    icon: '📋',
    iconBg: 'bg-blue-500/10 text-blue-500',
    defaultSize: { w: 4, h: 6 },
    sizeLabel: 'Alto (4×6)',
  },
  {
    type: 'assistant_insight',
    title: 'Asistente IA',
    desc: 'Sugerencias predictivas e insights de inteligencia artificial.',
    icon: '🤖',
    iconBg: 'bg-purple-500/10 text-purple-500',
    defaultSize: { w: 6, h: 4 },
    sizeLabel: 'Grande (6×4)',
  },
  {
    type: 'system_status',
    title: 'Sistema',
    desc: 'Métricas de hardware, conectividad y logs de HomePilot.',
    icon: '📡',
    iconBg: 'bg-rose-500/10 text-rose-500',
    defaultSize: { w: 4, h: 4 },
    sizeLabel: 'Mediano (4×4)',
  },
  {
    type: 'clock_display',
    title: 'Reloj y Fecha',
    desc: 'Hora en tiempo real con 3 diseños (Minimal, Digital, Elegante).',
    icon: '🕐',
    iconBg: 'bg-teal-500/10 text-teal-500',
    defaultSize: { w: 4, h: 4 },
    sizeLabel: 'Mediano (4×4)',
  },
  {
    type: 'section',
    title: 'Sección',
    desc: 'Divisor de ancho completo para organizar tus tarjetas.',
    icon: '─',
    iconBg: 'bg-muted/80 text-muted-foreground',
    defaultSize: { w: 12, h: 2 },
    sizeLabel: 'Completo (12×2)',
  },
];

export const DashboardEditorToolbar: React.FC<DashboardEditorToolbarProps> = ({
  onAddWidget,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: CardCatalogItem) => {
    onAddWidget(item.type, item.defaultSize);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Action Button - Bottom Right */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[400] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-primary/30"
        title="Añadir Tarjeta"
        aria-label="Añadir Tarjeta"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Catalog Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative z-10 w-full max-w-2xl rounded-3xl bg-card/95 border border-border/40 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Catálogo de Tarjetas</p>
                <h3 className="text-xl font-black tracking-tight text-foreground mt-0.5">Seleccionar tipo de tarjeta</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-muted rounded-2xl transition-all active:scale-95"
              >
                <X className="w-5 h-5 text-muted-foreground/60" />
              </button>
            </div>

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CATALOG_ITEMS.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleSelect(item)}
                    className="group flex items-start gap-4 p-4 rounded-2xl border border-border/40 bg-muted/10 hover:bg-primary/[0.03] hover:border-primary/30 text-left transition-all duration-300 active:scale-[0.98]"
                  >
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold shadow-sm transition-transform duration-300 group-hover:scale-105", item.iconBg)}>
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">{item.title}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-1">{item.desc}</p>
                      <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 mt-2">{item.sizeLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
