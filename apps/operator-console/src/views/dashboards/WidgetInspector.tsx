import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { 
  X, Layout, Link2, Eye, Palette, 
  Settings2, Box, Zap
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { apiFetch } from '../../lib/apiClient';
import { API_BASE_URL } from '../../config';

const API = `${API_BASE_URL}/api/v1`;

interface WidgetInspectorProps {
  widget: DashboardWidget | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onRemove: (id: string) => void;
}

export function WidgetInspector({ widget, isOpen, onClose, onUpdate, onRemove }: WidgetInspectorProps) {
  const { t } = useTranslation();
  const { devices } = useDeviceSnapshotStore();
  const [scenes, setScenes] = useState<{ id: string; name: string }[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);

  const rooms = useDeviceSnapshotStore(state => 
    Object.values(state.roomsByHome).flat()
  );

  useEffect(() => {
    if (isOpen && widget?.type === 'scene_shortcut') {
      setLoadingScenes(true);
      apiFetch(`${API}/scenes`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setScenes(data);
        })
        .finally(() => setLoadingScenes(false));
    }
  }, [isOpen, widget?.type]);

  if (!widget) return null;

  const currentLayout = widget.config.layout;
  const currentBinding = widget.config.binding;
  const currentAppearance = widget.config.appearance;

  return (
    <div className={cn(
      "fixed top-0 right-0 h-full w-[400px] bg-card/80 backdrop-blur-3xl border-l border-border/40 shadow-2xl z-[300] transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) transform",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-border/10">
        <div className="flex flex-col">
           <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">{t('dashboards.inspector.title')}</span>
           </div>
           <h3 className="text-2xl font-black tracking-tighter text-foreground">
             {currentAppearance.title || widget.type.replace('_', ' ')}
           </h3>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-muted/50 rounded-2xl transition-all active:scale-95">
          <X className="w-6 h-6 text-muted-foreground/40" />
        </button>
      </div>

      {/* Content */}
      <div className="p-8 space-y-10 overflow-y-auto h-[calc(100%-180px)] no-scrollbar">
        
        {/* Section: Identidad */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground/60 px-1">
             <Settings2 className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">{t('dashboards.inspector.identity')}</span>
          </div>
          <div className="space-y-2">
             <input 
               placeholder={t('dashboards.inspector.custom_title_placeholder')}
               value={currentAppearance.title || ''}
               onChange={(e) => onUpdate(widget.id, { appearance: { ...currentAppearance, title: e.target.value } })}
               className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all shadow-inner"
             />
             <p className="text-[9px] text-muted-foreground/40 px-2 leading-relaxed">{t('dashboards.inspector.custom_title_hint')}</p>
          </div>
        </div>

        {/* Section: Dimensiones */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground/60 px-1">
             <Layout className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">{t('dashboards.inspector.dimensions')}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.width_label')}</label>
                <select 
                  value={currentLayout.w}
                  onChange={(e) => onUpdate(widget.id, { layout: { ...currentLayout, w: parseInt(e.target.value) } })}
                  className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-black focus:outline-none focus:border-primary/50"
                >
                  {[2, 3, 4, 6, 8, 12].map(val => <option key={val} value={val}>{val} {t('dashboards.inspector.cols')}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.height_label')}</label>
                <select 
                  value={currentLayout.h}
                  onChange={(e) => onUpdate(widget.id, { layout: { ...currentLayout, h: parseInt(e.target.value) } })}
                  className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-black focus:outline-none focus:border-primary/50"
                >
                  {[2, 3, 4, 5, 6, 8, 10, 12].map(val => <option key={val} value={val}>{val} {t('dashboards.inspector.units')}</option>)}
                </select>
             </div>
          </div>
        </div>

        {/* Section: Binding (Real data) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground/60 px-1">
             <Link2 className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">{t('dashboards.inspector.binding')}</span>
          </div>
          
          <div className="space-y-3">
              {/* Guided Configuration Steps */}
              <div className="p-5 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
                 <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('dashboards.inspector.guided_config')}</span>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3">
                       <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", currentAppearance.title ? "bg-primary border-primary" : "border-muted")}>
                          {currentAppearance.title && <Box className="w-2 h-2 text-primary-foreground" />}
                       </div>
                       <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">{t('dashboards.inspector.step_name')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", currentBinding.entityId ? "bg-primary border-primary" : "border-muted")}>
                          {currentBinding.entityId && <Box className="w-2 h-2 text-primary-foreground" />}
                       </div>
                       <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">{t('dashboards.inspector.step_bind')}</span>
                    </div>
                 </div>
              </div>

              {/* Energy Selector */}
              {widget.type === 'energy_snapshot' && (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                   <div className="flex items-center gap-2 text-primary">
                      <Zap className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboards.inspector.auto_monitor')}</span>
                   </div>
                   <p className="text-[9px] text-muted-foreground leading-relaxed">
                      {t('dashboards.inspector.auto_monitor_desc')}
                   </p>
                </div>
              )}

              {/* Device Selector */}
              {(widget.type === 'device_control') && (
                 <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.target_device')}</label>
                  <select 
                    value={currentBinding.entityId || ''}
                    onChange={(e) => onUpdate(widget.id, { 
                      binding: { ...currentBinding, entityId: e.target.value, entityType: 'device' } 
                    })}
                    className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-primary/50"
                  >
                    <option value="">{t('dashboards.inspector.select_device_placeholder')}</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({t(`device_types.${d.type}`, { defaultValue: d.type })})</option>)}
                  </select>
               </div>
             )}

             {/* Room Selector */}
             {(widget.type === 'room_overview') && (
                 <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.reference_room')}</label>
                  <select 
                    value={currentBinding.entityId || ''}
                    onChange={(e) => onUpdate(widget.id, { 
                      binding: { ...currentBinding, entityId: e.target.value, entityType: 'room' } 
                    })}
                    className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-primary/50"
                  >
                    <option value="">{t('dashboards.inspector.select_room_placeholder')}</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
             )}

             {/* Scene Selector */}
             {widget.type === 'scene_shortcut' && (
               <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.scene_to_trigger')}</label>
                  <select 
                    value={currentBinding.entityId || ''}
                    disabled={loadingScenes}
                    onChange={(e) => onUpdate(widget.id, { 
                      binding: { ...currentBinding, entityId: e.target.value, entityType: 'scene' } 
                    })}
                    className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-primary/50"
                  >
                    <option value="">{loadingScenes ? t('dashboards.inspector.loading_scenes') : t('dashboards.inspector.select_scene_placeholder')}</option>
                    {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
             )}
          </div>
        </div>

        {/* Section: Visibility Rules (Simplified) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground/60 px-1">
             <Eye className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">{t('dashboards.visibility.label')}</span>
          </div>
          
          <div className="space-y-3">
             <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{t('dashboards.inspector.condition_label')}</label>
                <select 
                  value={widget.config.visibility.rules[0]?.type || 'always'}
                  onChange={(e) => {
                    const type = e.target.value as any;
                    onUpdate(widget.id, { 
                      visibility: { 
                        ...widget.config.visibility,
                        rules: [{ id: 'r1', type, action: 'show', value: '' }] 
                      } 
                    });
                  }}
                  className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-primary/50"
                >
                  <option value="always">{t('dashboards.visibility.always')}</option>
                  <option value="device_on">{t('dashboards.visibility.device_on')}</option>
                  <option value="has_alerts">{t('dashboards.visibility.has_alerts')}</option>
                  <option value="time_range">{t('dashboards.visibility.time_range')}</option>
                </select>
             </div>

             {/* Rule Contextual Values */}
             {widget.config.visibility.rules[0]?.type === 'device_on' && (
               <div className="p-4 rounded-2xl bg-muted/10 border border-border/40 space-y-3 animate-in slide-in-from-top-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Seleccionar Sensor/Luz</label>
                  <select 
                    value={widget.config.visibility.rules[0].value || ''}
                    onChange={(e) => {
                      const rules = [...widget.config.visibility.rules];
                      rules[0] = { ...rules[0], value: e.target.value };
                      onUpdate(widget.id, { visibility: { ...widget.config.visibility, rules } });
                    }}
                    className="w-full bg-background border border-border/40 rounded-xl px-3 py-2 text-[10px] font-bold"
                  >
                    <option value="">Seleccionar...</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
               </div>
             )}

             {widget.config.visibility.rules[0]?.type === 'time_range' && (
               <div className="p-4 rounded-2xl bg-muted/10 border border-border/40 space-y-3 animate-in slide-in-from-top-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Rango (HH:mm-HH:mm)</label>
                  <input 
                    type="text"
                    placeholder="08:00-22:00"
                    value={widget.config.visibility.rules[0].value || ''}
                    onChange={(e) => {
                      const rules = [...widget.config.visibility.rules];
                      rules[0] = { ...rules[0], value: e.target.value };
                      onUpdate(widget.id, { visibility: { ...widget.config.visibility, rules } });
                    }}
                    className="w-full bg-background border border-border/40 rounded-xl px-3 py-2 text-[10px] font-bold"
                  />
               </div>
             )}
          </div>
        </div>

        {/* Section: Appearance */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground/60 px-1">
             <Palette className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">{t('dashboards.inspector.appearance')}</span>
          </div>
          <div className="space-y-5">
             <div className="grid grid-cols-2 gap-3">
                {(['glass', 'solid', 'radiant', 'outline', 'flat'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => onUpdate(widget.id, { appearance: { ...currentAppearance, variant: v } })}
                    className={cn(
                      "group flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300",
                      currentAppearance.variant === v 
                        ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5" 
                        : "bg-muted/10 border-border/40 text-muted-foreground hover:border-primary/20"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">{v}</span>
                    <Box className={cn("w-3.5 h-3.5 transition-transform duration-500", currentAppearance.variant === v && "scale-110")} />
                  </button>
                ))}
             </div>
             
             <div className="p-5 rounded-3xl bg-muted/10 border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Mostrar Título</span>
                   </div>
                   <button 
                     onClick={() => onUpdate(widget.id, { appearance: { ...currentAppearance, showTitle: !currentAppearance.showTitle } })}
                     className={cn(
                       "w-10 h-5 rounded-full transition-all duration-300 relative border",
                       currentAppearance.showTitle ? "bg-primary border-primary" : "bg-muted border-border/60"
                     )}
                   >
                      <div className={cn(
                        "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
                        currentAppearance?.showTitle ? "left-[22px]" : "left-1"
                      )} />
                   </button>
                </div>
             </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 w-full p-8 border-t border-border/10 bg-card/40 flex flex-col gap-3">
         <Button 
           variant="secondary" 
           className="w-full font-black uppercase tracking-[0.2em] text-[10px] text-destructive hover:bg-destructive/10 border-destructive/20 py-4 rounded-2xl" 
           onClick={() => { if (window.confirm(t('common.confirm_action'))) { onRemove(widget.id); onClose(); } }}
         >
            {t('dashboards.inspector.delete_widget')}
         </Button>
         <Button variant="primary" className="w-full font-black uppercase tracking-[0.2em] text-[11px] py-4 rounded-2xl shadow-2xl shadow-primary/20" onClick={onClose}>
            {t('dashboards.inspector.finish')}
         </Button>
      </div>
    </div>
  );
}
