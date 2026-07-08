import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { CLOCK_STYLES, getClockStyleLabel } from './widgets/clock';
import ConfirmModal from '../../components/ConfirmModal';
import * as Icons from 'lucide-react';

const API = `${API_BASE_URL}/api/v1`;

interface WidgetInspectorProps {
  widget: DashboardWidget | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onRemove: (id: string) => void;
}

const SIZE_PRESETS = [
  { label: 'XS', w: 2, h: 2 },
  { label: 'S',  w: 2, h: 3 },
  { label: 'M',  w: 4, h: 4 },
  { label: 'L',  w: 6, h: 5 },
  { label: 'XL', w: 8, h: 6 },
] as const;

export function WidgetInspector({ widget, isOpen, onClose, onUpdate, onRemove }: WidgetInspectorProps) {
  const { t, i18n } = useTranslation();
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

  const [iconQuery, setIconQuery] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Local string states for dimension inputs - allow empty/in-progress typing
  const [localW, setLocalW] = useState('');
  const [localH, setLocalH] = useState('');

  useEffect(() => {
    if (widget) {
      setIconQuery(widget.config.appearance?.icon || '');
      setLocalW(String(widget.config.layout.w));
      setLocalH(String(widget.config.layout.h));
    }
  // Only re-sync when the selected widget changes, not on every layout update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget?.id]);

  const computeDropdownPos = () => {
    if (!iconInputRef.current) return;
    const rect = iconInputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  const safeWidget = useMemo(() => widget ? sanitizeWidget(widget) : null, [widget]);

  const SelectedIconComponent = useMemo(() => {
    if (!iconQuery) return null;
    let clean = iconQuery.trim();
    if (clean.toLowerCase().startsWith('mdi:')) clean = clean.substring(4);
    const translations: Record<string, string> = {
      gata: 'Cat', gato: 'Cat', perro: 'Dog', perra: 'Dog',
      luz: 'Lightbulb', foco: 'Lightbulb', interruptor: 'Power',
      enchufe: 'Plug', camara: 'Camera', tv: 'Tv', musica: 'Music',
      bocina: 'Speaker', parlante: 'Speaker', llave: 'Key',
      candado: 'Lock', escudo: 'Shield', termometro: 'Thermometer',
      aire: 'Wind', ventilador: 'Fan'
    };
    const key = clean.toLowerCase();
    const resolvedName = translations[key] || Object.keys(Icons).find(k => k.toLowerCase() === key) || clean;
    const matchKey = Object.keys(Icons).find(k => k.toLowerCase() === resolvedName.toLowerCase());
    return matchKey ? (Icons as any)[matchKey] : null;
  }, [iconQuery]);

  const matchingIcons = useMemo(() => {
    if (!iconQuery || iconQuery.length < 2) return [];
    
    let clean = iconQuery.trim();
    if (clean.toLowerCase().startsWith('mdi:')) {
      clean = clean.substring(4);
    }
    
    const translations: Record<string, string> = {
      gata: 'cat',
      gato: 'cat',
      perro: 'dog',
      perra: 'dog',
      luz: 'light',
      foco: 'lightbulb',
      interruptor: 'power',
      enchufe: 'plug',
      camara: 'camera',
      tv: 'tv',
      musica: 'music',
      bocina: 'speaker',
      parlante: 'speaker',
      llave: 'key',
      candado: 'lock',
      escudo: 'shield',
      termometro: 'thermometer',
      aire: 'wind',
      ventilador: 'fan'
    };
    
    const searchKey = clean.toLowerCase();
    const translatedSearchKey = translations[searchKey] || searchKey;
    
    const allKeys = Object.keys(Icons).filter(key => {
      const val = (Icons as any)[key];
      // lucide-react icons are React.forwardRef objects (typeof 'object') or plain function components
      return (
        key[0] === key[0].toUpperCase() &&
        key[0] !== '_' &&
        key !== 'Icons' &&
        (typeof val === 'function' || (typeof val === 'object' && val !== null))
      );
    });

    return allKeys
      .filter(key => key.toLowerCase().includes(translatedSearchKey))
      .slice(0, 12);
  }, [iconQuery]);

  if (!isOpen || !widget || !safeWidget) return null;

  const layout     = safeWidget.config.layout;
  const binding    = safeWidget.config.binding;
  const appearance = safeWidget.config.appearance;
  const extra      = safeWidget.config.extra ?? {};
  const isSection  = safeWidget.type === 'section';
  const isClock    = safeWidget.type === 'clock_display';
  const isEnglish = (i18n.language || document.documentElement.lang || navigator.language || 'es')
    .toLowerCase()
    .startsWith('en');

  const minLayoutW = isClock ? 4 : 1;
  const minLayoutH = isClock ? 4 : 1;

  const effectiveSizePresets = isClock
    ? SIZE_PRESETS.filter((preset) => preset.w >= minLayoutW && preset.h >= minLayoutH)
    : SIZE_PRESETS;

  const quickSizeLabel = isEnglish
    ? (isClock ? 'Clock size' : 'Quick size')
    : (isClock ? 'TamaÃ±o de reloj' : 'TamaÃ±o rÃ¡pido');

  const clockDesignLabel = isEnglish ? 'Clock design' : 'DiseÃ±o de reloj';

  const boundDevice = safeWidget.type === 'device_control' ? devices.find(d => d.id === binding.entityId) : null;
  const isCamera   = boundDevice ? (boundDevice.type === 'camera' || boundDevice.semanticType === 'camera') : false;
  const showIconField = !isSection && !isClock && !isCamera;

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
              {isSection ? 'T\u00edtulo de secci\u00f3n' : t('dashboards.inspector.custom_title_placeholder')}
            </label>
            <input
              placeholder={isSection ? 'Mi SecciÃƒÆ’Ã‚Â³n' : t('dashboards.inspector.custom_title_placeholder')}
              value={appearance.title || ''}
              onChange={(e) => onUpdate(safeWidget.id, { appearance: { ...appearance, title: e.target.value } })}
              className="w-full bg-muted/20 border border-border/40 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>

          {/* Size presets (not for section) */}
          {!isSection && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{quickSizeLabel}</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {effectiveSizePresets.map((preset) => {
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
                        <span className="text-[10px] font-black uppercase">{preset.label}</span>
                        <span className="text-[8px] opacity-50 tabular-nums">{preset.w}\u00d7{preset.h}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/10">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 block mb-1">Ancho (columnas)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full bg-muted/20 border border-border/40 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary/50 transition-all [appearance:textfield]"
                    value={localW}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setLocalW(v);
                      if (v !== '') {
                        const n = Math.max(minLayoutW, Math.min(12, parseInt(v)));
                        onUpdate(safeWidget.id, { layout: { ...layout, w: n } });
                      }
                    }}
                    onBlur={() => {
                      if (localW === '' || parseInt(localW) < minLayoutW) {
                        setLocalW(String(minLayoutW));
                        onUpdate(safeWidget.id, { layout: { ...layout, w: minLayoutW } });
                      } else {
                        const n = Math.max(minLayoutW, Math.min(12, parseInt(localW)));
                        setLocalW(String(n));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 block mb-1">Alto (filas)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full bg-muted/20 border border-border/40 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary/50 transition-all [appearance:textfield]"
                    value={localH}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setLocalH(v);
                      if (v !== '') {
                        const n = Math.max(minLayoutH, Math.min(20, parseInt(v)));
                        onUpdate(safeWidget.id, { layout: { ...layout, h: n } });
                      }
                    }}
                    onBlur={() => {
                      if (localH === '' || parseInt(localH) < minLayoutH) {
                        setLocalH(String(minLayoutH));
                        onUpdate(safeWidget.id, { layout: { ...layout, h: minLayoutH } });
                      } else {
                        const n = Math.max(minLayoutH, Math.min(20, parseInt(localH)));
                        setLocalH(String(n));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Clock style picker */}
          {isClock && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{clockDesignLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {CLOCK_STYLES.map(style => {
                  const isActive = (extra.clockStyle ?? 'minimal') === style.value;
                  return (
                    <button
                      key={style.value}
                      onClick={() => onUpdate(safeWidget.id, { extra: { ...extra, clockStyle: style.value }, layout: { ...layout, w: Math.max(layout.w, style.minW), h: Math.max(layout.h, style.minH) } })}
                      className={cn(
                        "py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-wide transition-all",
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/10 border-border/40 text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {getClockStyleLabel(style, i18n.language)}
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
                onChange={(val) => {
                  const selectedDevice = devices.find(d => d.id === val);
                  onUpdate(safeWidget.id, {
                    binding: {
                      ...binding,
                      entityId: val,
                      entityType: 'device',
                      entityName: selectedDevice?.name,
                    }
                  });
                }}
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

          {/* Custom Icon */}
          {showIconField && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Icono (opcional)</label>
              <div className="relative flex items-center">
                {SelectedIconComponent ? (
                  <SelectedIconComponent className="absolute left-3 w-5 h-5 text-primary pointer-events-none" />
                ) : (
                  <Icons.HelpCircle className="absolute left-3 w-5 h-5 text-muted-foreground/30 pointer-events-none" />
                )}
                <input
                  ref={iconInputRef}
                  type="text"
                  className="w-full h-10 pl-10 pr-3 bg-card border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="Ej: Lightbulb, Power, Tv, Gata, Perro"
                  value={iconQuery}
                  onFocus={computeDropdownPos}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIconQuery(val);
                    onUpdate(safeWidget.id, { appearance: { ...appearance, icon: val } });
                    setTimeout(computeDropdownPos, 0);
                  }}
                  onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
                />
              </div>
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

      {/* Icon suggestions portal - renders outside overflow-hidden containers */}
      {showIconField && dropdownPos && matchingIcons.length > 0 && createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card shadow-2xl p-1.5 space-y-0.5"
          onMouseDown={(e) => e.preventDefault()}
        >
          {matchingIcons.map(iconName => {
            const IconComponent = (Icons as any)[iconName];
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => {
                  setIconQuery(iconName);
                  setDropdownPos(null);
                  onUpdate(safeWidget.id, { appearance: { ...appearance, icon: iconName } });
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors text-foreground/80"
              >
                {IconComponent && <IconComponent className="w-5 h-5 shrink-0" />}
                <span>{iconName}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
