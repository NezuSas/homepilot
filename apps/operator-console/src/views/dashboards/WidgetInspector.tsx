import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { sanitizeWidget } from './dashboardUtils';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { apiFetch } from '../../lib/apiClient';
import { API_BASE_URL } from '../../config';
import type { ClockStyle } from './widgets/ClockWidget';
import ConfirmModal from '../../components/ConfirmModal';

const API = `${API_BASE_URL}/api/v1`;

interface WidgetInspectorProps {
  widget: DashboardWidget | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onRemove: (id: string) => void;
}

const SIZE_PRESETS = [
  { label: 'S',  w: 2, h: 3 },
  { label: 'M',  w: 4, h: 4 },
  { label: 'L',  w: 6, h: 5 },
  { label: 'XL', w: 8, h: 6 },
] as const;



const CLOCK_STYLES: { value: ClockStyle; label: string }[] = [
  { value: 'minimal',  label: 'Minimal'  },
  { value: 'digital',  label: 'Digital'  },
  { value: 'elegant',  label: 'Elegante' },
];

export function WidgetInspector({ widget, isOpen, onClose, onUpdate, onRemove }: WidgetInspectorProps) {
  const { t } = useTranslation();
  const { devices } = useDeviceSnapshotStore();
  const [scenes, setScenes] = useState<{ id: string; name: string }[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);

  const roomsByHome = useDeviceSnapshotStore(state => state.roomsByHome);
  const rooms = useMemo(() => Object.values(roomsByHome).flat(), [roomsByHome]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (isOpen && widget?.type === 'scene_shortcut') {
      setLoadingScenes(true);
      apiFetch(`${API}/scenes`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setScenes(data); })
        .finally(() => setLoadingScenes(false));
    }
  }, [isOpen, widget?.type]);

  const safeWidget = useMemo(() => widget ? sanitizeWidget(widget) : null, [widget]);

  if (!isOpen || !widget || !safeWidget) return null;

  const layout     = safeWidget.config.layout;
  const binding    = safeWidget.config.binding;
  const appearance = safeWidget.config.appearance;
  const extra      = safeWidget.config.extra ?? {};
  const isSection  = safeWidget.type === 'section';
  const isClock    = safeWidget.type === 'clock_display';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[50] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-3xl bg-card/95 border border-border/40 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/20">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/70 mb-0.5">
              {t('dashboards.inspector.title')}
            </p>
            <h3 className="text-lg font-black tracking-tight text-foreground leading-none">
              {appearance.title || safeWidget.type.replace('_', ' ')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted/60 rounded-2xl transition-all active:scale-95"
          >
            <X className="w-5 h-5 text-muted-foreground/50" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
              {isSection ? 'Título de sección' : t('dashboards.inspector.custom_title_placeholder')}
            </label>
            <input
              placeholder={isSection ? 'Mi Sección' : t('dashboards.inspector.custom_title_placeholder')}
              value={appearance.title || ''}
              onChange={(e) => onUpdate(safeWidget.id, { appearance: { ...appearance, title: e.target.value } })}
              className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>

          {/* Size presets (not for section) */}
          {!isSection && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Tamaño</label>
              <div className="grid grid-cols-4 gap-2">
                {SIZE_PRESETS.map(preset => {
                  const isActive = layout.w === preset.w && layout.h === preset.h;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => onUpdate(safeWidget.id, { layout: { ...layout, w: preset.w, h: preset.h } })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2.5 rounded-2xl border transition-all text-center",
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/10 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      <span className="text-[11px] font-black uppercase">{preset.label}</span>
                      <span className="text-[8px] opacity-50 tabular-nums">{preset.w}×{preset.h}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clock style picker */}
          {isClock && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Diseño de reloj</label>
              <div className="grid grid-cols-3 gap-2">
                {CLOCK_STYLES.map(style => {
                  const isActive = (extra.clockStyle ?? 'minimal') === style.value;
                  return (
                    <button
                      key={style.value}
                      onClick={() => onUpdate(safeWidget.id, { extra: { ...extra, clockStyle: style.value } })}
                      className={cn(
                        "py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-wide transition-all",
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/10 border-border/40 text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Device / Room / Scene binding */}
          {widget.type === 'device_control' && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                {t('dashboards.inspector.target_device')}
              </label>
              <SelectField
                label=""
                value={binding.entityId || ''}
                placeholder={t('dashboards.inspector.select_device_placeholder')}
                onChange={(val) => onUpdate(safeWidget.id, { binding: { ...binding, entityId: val, entityType: 'device' } })}
                options={devices.map(d => ({ value: d.id, label: `${d.name} (${t(`device_types.${d.type}`, { defaultValue: d.type })})` }))}
              />
            </div>
          )}

          {(widget.type === 'room_overview' || widget.type === 'room_summary') && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                {t('dashboards.inspector.reference_room')}
              </label>
              <SelectField
                label=""
                value={binding.entityId || ''}
                placeholder={t('dashboards.inspector.select_room_placeholder')}
                onChange={(val) => onUpdate(safeWidget.id, { binding: { ...binding, entityId: val, entityType: 'room' } })}
                options={rooms.map(r => ({ value: r.id, label: r.name }))}
              />
            </div>
          )}

          {widget.type === 'scene_shortcut' && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                {t('dashboards.inspector.scene_to_trigger')}
              </label>
              <SelectField
                label=""
                value={binding.entityId || ''}
                loading={loadingScenes}
                placeholder={loadingScenes ? t('dashboards.inspector.loading_scenes') : t('dashboards.inspector.select_scene_placeholder')}
                onChange={(val) => onUpdate(safeWidget.id, { binding: { ...binding, entityId: val, entityType: 'scene' } })}
                options={scenes.map(s => ({ value: s.id, label: s.name }))}
              />
            </div>
          )}

          {/* Custom Icon (not for section) */}
          {!isSection && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Icono (Opcional)</label>
              <input
                type="text"
                className="w-full h-10 px-3 bg-card border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Ej: Lightbulb, Power, Tv"
                value={appearance.icon || ''}
                onChange={(e) => onUpdate(safeWidget.id, { appearance: { ...appearance, icon: e.target.value } })}
              />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-border/10 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 text-destructive hover:bg-destructive/10 border-destructive/20 rounded-2xl py-2.5 text-[10px] font-black uppercase tracking-wider"
            onClick={() => setIsConfirmDeleteOpen(true)}
          >
            {t('dashboards.inspector.delete_widget')}
          </Button>
          <Button
            variant="primary"
            className="flex-1 rounded-2xl py-2.5 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-primary/20"
            onClick={onClose}
          >
            {t('dashboards.inspector.finish')}
          </Button>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          onRemove(safeWidget.id);
          setIsConfirmDeleteOpen(false);
          onClose();
        }}
        title={t('dashboards.inspector.delete_widget')}
        description={t('common.confirm_action')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </div>
  );
}
