import React, { useEffect, useState } from 'react';
import { Eye, Image, MoreVertical, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

type ConfigTab = 'settings' | 'background' | 'visibility';

interface DashboardViewConfigModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSave: (title: string) => void;
  onDelete: () => void;
}

export const DashboardViewConfigModal: React.FC<DashboardViewConfigModalProps> = ({
  isOpen,
  title,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfigTab>('settings');
  const [draftTitle, setDraftTitle] = useState(title);
  const [backgroundOpacity, setBackgroundOpacity] = useState(50);
  const [visibility, setVisibility] = useState({
    owner: true,
    admin: true,
    guests: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle(title);
    setActiveTab('settings');
  }, [isOpen, title]);

  if (!isOpen) return null;

  const tabs: Array<{ id: ConfigTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'settings', label: t('dashboards.view_config.settings'), icon: SlidersHorizontal },
    { id: 'background', label: t('dashboards.view_config.background'), icon: Image },
    { id: 'visibility', label: t('dashboards.view_config.visibility'), icon: Eye },
  ];

  const trimmedTitle = draftTitle.trim();
  const canSave = trimmedTitle.length > 0 && trimmedTitle !== title;

  return (
    <div className="absolute inset-0 z-[120] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center">
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border/70 bg-card text-foreground shadow-depth-3 sm:max-w-2xl sm:rounded-[1.75rem]">
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
            {t('dashboards.view_config.title', { title })}
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
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-bold transition-colors sm:text-sm',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <Icon className="hidden h-4 w-4 sm:block" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <section>
                <p className="mb-3 text-sm font-medium text-foreground">{t('dashboards.view_config.layout')}</p>
                <div className="space-y-3">
                  {['sections', 'masonry', 'sidebar', 'panel'].map((option, index) => (
                    <label key={option} className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="radio"
                        name="dashboard-layout"
                        defaultChecked={index === 0}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>{t(`dashboards.view_config.layouts.${option}`)}</span>
                    </label>
                  ))}
                </div>
              </section>

              <label className="block rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">{t('dashboards.view_config.view_title')}</span>
                <input
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  className="mt-1 w-full bg-transparent text-base text-foreground outline-none"
                />
              </label>

              <div className="rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">{t('dashboards.view_config.icon')}</span>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>mdi:home-account</span>
                  <X className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <label className="block rounded-xl bg-muted/45 px-4 py-3">
                <span className="block text-xs font-semibold text-muted-foreground">URL</span>
                <input className="mt-1 w-full bg-transparent text-base text-foreground outline-none" />
                <span className="mt-1 block text-xs text-muted-foreground">{t('dashboards.view_config.url_hint')}</span>
              </label>
            </div>
          )}

          {activeTab === 'background' && (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted/35 p-4 text-center">
                <div className="mx-auto aspect-video max-w-md rounded-lg bg-gradient-to-br from-muted via-card to-primary/10 opacity-70" />
                <button type="button" className="mt-3 text-sm font-semibold text-destructive">
                  {t('dashboards.view_config.clear_image')}
                </button>
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    {t('dashboards.view_config.scroll')}
                  </button>
                  <button type="button" className="rounded-full bg-primary/15 px-4 py-2 text-sm font-bold text-primary">
                    {t('dashboards.view_config.fixed')}
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">{t('dashboards.view_config.visibility_hint')}</p>
              {[
                ['owner', t('dashboards.view_config.visibility_owner')],
                ['admin', t('dashboards.view_config.visibility_admin')],
                ['guests', t('dashboards.view_config.visibility_guests')],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-muted/35">
                  <span className="text-sm">{label}</span>
                  <input
                    type="checkbox"
                    checked={visibility[key as keyof typeof visibility]}
                    onChange={event => setVisibility(current => ({ ...current, [key]: event.target.checked }))}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
              ))}
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
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave(trimmedTitle);
            }}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
};
