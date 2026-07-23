import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Eye, Image, MoreVertical, SlidersHorizontal, Trash2, X, Loader2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { IconPicker } from '../views/dashboards/components/IconPicker';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
import { ToggleSwitch } from './ui/ToggleSwitch';


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
    isDefault?: boolean;
  };
  onClose: () => void;
  onSave: (fields: {
    title: string;
    icon?: string;
    background?: string | null;
    backgroundOpacity?: number;
    visibility?: { users: string[] };
    isDefault?: boolean;
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
  const [isDefaultTab, setIsDefaultTab] = useState(tab.isDefault ?? false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state with props when modal opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle(tab.title);
    setBackgroundOpacity(tab.backgroundOpacity ?? 50);
    setBackgroundImg(tab.background || null);
    setAllowedUsers(tab.visibility?.users || []);
    setIconQuery(tab.icon || '');
    setIsDefaultTab(tab.isDefault ?? false);
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

  const tabs: Array<{ id: ConfigTab; label: string; icon: LucideIcon }> = [
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
      isDefault: isDefaultTab,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="relative flex max-h-viewport-modal w-full max-w-2xl flex-col overflow-hidden rounded-card border border-border/70 bg-card text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-5">
          <IconButton icon={X} label={t('common.close')} variant="ghost" onClick={onClose} />
          <h2 className="min-w-0 flex-1 truncate text-section-title font-semibold tracking-tight">
            {t('dashboards.view_config.title', { title: tab.title })}
          </h2>
          <IconButton icon={MoreVertical} label={t('common.more')} variant="ghost" />
        </header>

        <nav className="shrink-0 border-b border-border/60 px-5 py-3">
          <SegmentedControl
            value={activeTab}
            options={tabs.map(({ id, label, icon }) => ({ value: id, label, icon }))}
            onChange={setActiveTab}
            className="w-full"
            optionClassName="min-h-9 px-2 text-nano sm:min-h-10 sm:text-micro"
          />
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar">
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <Input
                label={t('dashboards.view_config.view_title')}
                value={draftTitle}
                onChange={event => setDraftTitle(event.target.value)}
                containerClassName="rounded-xl bg-muted/45 px-4 py-3"
                className="h-auto border-0 bg-transparent p-0 text-body-lg font-bold shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
              />

              <div className="rounded-xl bg-muted/45 px-4 py-3">
                {/* Shared picker: Home Assistant Material Design Icons + Lucide,
                    same catalog and resolver used by dashboard cards. */}
                <IconPicker
                  value={iconQuery}
                  onChange={setIconQuery}
                  label={t('dashboards.view_config.icon')}
                  placeholder={t('dashboards.view_config.icon_placeholder')}
                />
              </div>

              <Input
                label={t('dashboards.view_config.route_label')}
                value={routeSlug}
                readOnly
                helperText={t('dashboards.view_config.url_hint')}
                containerClassName="rounded-xl bg-muted/45 px-4 py-3"
                className="h-auto cursor-default border-0 bg-transparent p-0 text-body-lg font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
              />

              <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-body font-bold text-foreground">{t('dashboards.view_config.default_view')}</span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">{t('dashboards.view_config.default_view_hint')}</span>
                </span>
                <ToggleSwitch
                  checked={isDefaultTab}
                  onCheckedChange={setIsDefaultTab}
                  label={t('dashboards.view_config.default_view')}
                  size="sm"
                />
              </div>
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
                  <div className="mx-auto aspect-video max-w-md rounded-lg bg-gradient-to-br from-muted via-card to-primary/10 opacity-70 border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground/45 text-caption font-semibold">
                    {t('dashboards.view_config.no_image')}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    {t('dashboards.view_config.upload_image')}
                  </Button>
                  {backgroundImg && (
                    <Button variant="danger" size="sm" onClick={() => setBackgroundImg(null)}>
                      {t('dashboards.view_config.clear_image')}
                    </Button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <section className="rounded-xl border border-border/70 p-4">
                <p className="mb-5 text-body font-semibold">{t('dashboards.view_config.background_settings')}</p>
                <label className="grid gap-3 text-body">
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
                    <span className="w-14 rounded-lg bg-muted px-3 py-2 text-center text-body">{backgroundOpacity}</span>
                  </div>
                </label>
              </section>
            </div>
          )}

          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <p className="text-body text-foreground">{t('dashboards.editor.visibility_hint')}</p>
              {loadingUsers ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {users.map(user => {
                    const isChecked = allowedUsers.includes(user.id);
                    const userLabel = user.displayName || user.username;
                    return (
                      <div key={user.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-muted/10 px-3 py-2.5 transition-colors hover:bg-muted/35">
                        <span className="text-body font-bold">{userLabel}</span>
                        <ToggleSwitch
                          checked={isChecked}
                          onCheckedChange={checked => {
                            if (checked) {
                              setAllowedUsers(prev => [...prev, user.id]);
                            } else {
                              setAllowedUsers(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          label={userLabel}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-caption text-muted-foreground">{t('dashboards.view_config.no_other_users')}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="px-0 text-destructive hover:bg-transparent hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            {t('dashboards.view_config.delete_view')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </footer>
      </div>
    </div>
  );
};
