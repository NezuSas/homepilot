import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Image, MoreVertical, SlidersHorizontal, Trash2, X, Loader2, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import * as Icons from 'lucide-react';


const MAX_BG_PX = 1920;
const BG_QUALITY = 0.8;

type ConfigTab = 'settings' | 'background' | 'visibility';

interface DashboardViewConfigModalProps {
  isOpen: boolean;
  tab: {
    title: string;
    layout?: 'sections' | 'masonry' | 'sidebar' | 'panel';
    icon?: string;
    background?: string;
    backgroundOpacity?: number;
    visibility?: { users: string[] };
  };
  onClose: () => void;
  onSave: (fields: {
    title: string;
    icon?: string;
    background?: string | null;
    backgroundOpacity?: number;
    visibility?: { users: string[] };
  }) => void;
  onDelete: () => void;
}

export const DashboardViewConfigModal: React.FC<DashboardViewConfigModalProps> = ({
  isOpen,
  tab,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfigTab>('settings');
  const [draftTitle, setDraftTitle] = useState(tab.title);
  const [backgroundOpacity, setBackgroundOpacity] = useState(tab.backgroundOpacity ?? 50);
  const [backgroundImg, setBackgroundImg] = useState<string | null>(tab.background || null);
  const [allowedUsers, setAllowedUsers] = useState<string[]>(tab.visibility?.users || []);

  const [users, setUsers] = useState<Array<{ id: string; username: string; displayName?: string | null }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [iconQuery, setIconQuery] = useState(tab.icon || '');
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Sync state with props when modal opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle(tab.title);
    setBackgroundOpacity(tab.backgroundOpacity ?? 50);
    setBackgroundImg(tab.background || null);
    setAllowedUsers(tab.visibility?.users || []);
    setIconQuery(tab.icon || '');
    setActiveTab('settings');

    // Fetch users for visibility tab
    setLoadingUsers(true);
    apiFetch(`${API_BASE_URL}/api/v1/admin/users`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [isOpen, tab]);

  const computeDropdownPos = () => {
    if (!iconInputRef.current) return;
    const rect = iconInputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  const SelectedIconComponent = useMemo(() => {
    if (!iconQuery) return null;
    let clean = iconQuery.trim();
    if (clean.toLowerCase().startsWith('mdi:')) {
      clean = clean.substring(4);
    }
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
      gata: 'cat', gato: 'cat', perro: 'dog', perra: 'dog',
      luz: 'lightbulb', foco: 'lightbulb', interruptor: 'power',
      enchufe: 'plug', camara: 'camera', tv: 'tv', musica: 'music',
      bocina: 'speaker', parlante: 'speaker', llave: 'key',
      candado: 'lock', escudo: 'shield', termometro: 'thermometer',
      aire: 'wind', ventilador: 'fan'
    };
    const searchKey = clean.toLowerCase();
    const translatedSearchKey = translations[searchKey] || searchKey;

    const allKeys = Object.keys(Icons).filter(key => {
      const val = (Icons as any)[key];
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

  const routeSlug = useMemo(() => {
    const source = draftTitle.trim() || tab.title || 'view';
    return source
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'view';
  }, [draftTitle, tab.title]);

  if (!isOpen) return null;

  const tabs: Array<{ id: ConfigTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'settings', label: t('dashboards.view_config.settings'), icon: SlidersHorizontal },
    { id: 'background', label: t('dashboards.view_config.background'), icon: Image },
    { id: 'visibility', label: t('dashboards.view_config.visibility'), icon: Eye },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Resize to at most MAX_BG_PX on the longest side
        let { width, height } = img;
        if (width > MAX_BG_PX || height > MAX_BG_PX) {
          if (width > height) {
            height = Math.round((height / width) * MAX_BG_PX);
            width = MAX_BG_PX;
          } else {
            width = Math.round((width / height) * MAX_BG_PX);
            height = MAX_BG_PX;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', BG_QUALITY);
        setBackgroundImg(compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    const trimmedTitle = draftTitle.trim();
    if (trimmedTitle.length === 0) return;

    onSave({
      title: trimmedTitle,
      icon: iconQuery.trim() || undefined,
      background: backgroundImg,
      backgroundOpacity,
      visibility: { users: allowedUsers },
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {t('dashboards.view_config.title', { title: tab.title })}
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('common.more', { defaultValue: 'More' })}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </header>

        <nav className="grid shrink-0 grid-cols-3 border-b border-border/60">
          {tabs.map(tabItem => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setActiveTab(tabItem.id)}
                className={cn(
                  'flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-black transition-colors sm:text-sm',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <Icon className="hidden h-4 w-4 sm:block" />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar">
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <label className="block rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">{t('dashboards.view_config.view_title')}</span>
                <input
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  className="mt-1 w-full bg-transparent text-base font-bold text-foreground outline-none"
                />
              </label>

              <div className="rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">{t('dashboards.view_config.icon')}</span>
                <div className="relative mt-2 flex items-center">
                  {SelectedIconComponent ? (
                    <SelectedIconComponent className="absolute left-3 w-5 h-5 text-primary" />
                  ) : (
                    <HelpCircle className="absolute left-3 w-5 h-5 text-muted-foreground/30" />
                  )}
                  <input
                    ref={iconInputRef}
                    type="text"
                    className="w-full h-10 pl-10 pr-10 bg-transparent text-sm font-bold text-foreground outline-none"
                    placeholder="Ej: Home, Lightbulb, Tv"
                    value={iconQuery}
                    onFocus={computeDropdownPos}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIconQuery(val);
                      setTimeout(computeDropdownPos, 0);
                    }}
                    onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
                  />
                  {iconQuery && (
                    <button
                      type="button"
                      onClick={() => setIconQuery('')}
                      className="absolute right-3 p-1 rounded-full hover:bg-muted text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">{t('dashboards.view_config.route_label')}</span>
                <input
                  value={routeSlug}
                  readOnly
                  className="mt-1 w-full cursor-default bg-transparent text-base font-semibold text-foreground outline-none"
                />
                <span className="mt-1 block text-xs text-muted-foreground">{t('dashboards.view_config.url_hint')}</span>
              </label>
            </div>
          )}

          {activeTab === 'background' && (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted/35 p-4 text-center">
                {backgroundImg ? (
                  <img
                    src={backgroundImg.startsWith('/') ? `${API_BASE_URL}${backgroundImg}` : backgroundImg}
                    alt="Background Preview"
                    className="mx-auto aspect-video max-w-md rounded-lg object-cover border border-border/40 shadow-inner"
                  />
                ) : (
                  <div className="mx-auto aspect-video max-w-md rounded-lg bg-gradient-to-br from-muted via-card to-primary/10 opacity-70 border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground/45 text-xs font-semibold">
                    No hay imagen seleccionada
                  </div>
                )}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/95 rounded-2xl px-5 py-2.5 shadow-lg shadow-primary/20 transition-all"
                  >
                    Subir Imagen
                  </button>
                  {backgroundImg && (
                    <button
                      type="button"
                      onClick={() => setBackgroundImg(null)}
                      className="text-xs font-black uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive/15 rounded-2xl px-5 py-2.5 transition-all"
                    >
                      {t('dashboards.view_config.clear_image')}
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <section className="rounded-xl border border-border/70 p-4">
                <p className="mb-5 text-sm font-semibold">{t('dashboards.view_config.background_settings')}</p>
                <label className="grid gap-3 text-sm">
                  <span>{t('dashboards.view_config.background_opacity')}</span>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={backgroundOpacity}
                      onChange={event => setBackgroundOpacity(Number(event.target.value))}
                      className="min-w-0 flex-1 accent-primary"
                    />
                    <span className="w-14 rounded-lg bg-muted px-3 py-2 text-center text-sm">{backgroundOpacity}</span>
                  </div>
                </label>
              </section>
            </div>
          )}

          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">Seleccione qué usuarios deberían ver esta vista en la navegación</p>
              {loadingUsers ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {users.map(user => {
                    const isChecked = allowedUsers.includes(user.id);
                    return (
                      <label key={user.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/35 cursor-pointer transition-colors border border-border/10 bg-muted/10">
                        <span className="text-sm font-bold">{user.displayName || user.username}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setAllowedUsers(prev => [...prev, user.id]);
                            } else {
                              setAllowedUsers(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          className="h-5 w-5 accent-primary rounded-lg"
                        />
                      </label>
                    );
                  })}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">No hay otros usuarios registrados</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 text-sm font-semibold text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {t('dashboards.view_config.delete_view')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </footer>
      </div>

      {/* Portal icon autocomplete suggestions dropdown */}
      {activeTab === 'settings' && dropdownPos && matchingIcons.length > 0 && createPortal(
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
};
