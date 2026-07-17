import * as Icons from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { Dashboard } from '../views/dashboards/types';
import { InlineTabCreator } from './InlineTabCreator';
import { getDashboardIconComponent } from '../views/dashboards/components/IconPicker';

interface DashboardTabsNavProps {
  tabs: Dashboard['tabs'];
  activeTabIdx: number;
  onOpenMobileMenu?: () => void;
  isEditing: boolean;
  isAddingTab: boolean;
  placeholder: string;
  addLabel: string;
  configureLabel: string;
  onSelectTab: (index: number) => void;
  onConfigureTab: (index: number) => void;
  onStartAddingTab?: () => void;
  onAddTab: (title: string) => void;
  onCancelAddingTab: () => void;
  onToggleEditing?: () => void;
  editLabel?: string;
}

export const DashboardTabsNav: React.FC<DashboardTabsNavProps> = ({
  tabs,
  activeTabIdx,
  onOpenMobileMenu,
  isEditing,
  isAddingTab,
  placeholder,
  addLabel,
  configureLabel,
  onSelectTab,
  onConfigureTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab,
  onToggleEditing,
  editLabel
}) => {
  const { t } = useTranslation();

  const getTabIcon = (tab: Dashboard['tabs'][number], index: number) => {
    if (tab.icon) {
      const raw = tab.icon.trim();
      const withoutPrefix = raw.replace(/^mdi:/i, '');

      // Legacy Spanish aliases stored before the shared MDI+Lucide catalog
      // existed; kept so previously saved tab icons keep resolving.
      const translations: Record<string, string> = {
        gata: 'Cat', gato: 'Cat', perro: 'Dog', perra: 'Dog',
        luz: 'Lightbulb', foco: 'Lightbulb', interruptor: 'Power',
        enchufe: 'Plug', camara: 'Camera', tv: 'Tv', musica: 'Music',
        bocina: 'Speaker', parlante: 'Speaker', llave: 'Key',
        candado: 'Lock', escudo: 'Shield', termometro: 'Thermometer',
        aire: 'Wind', ventilador: 'Fan'
      };

      const alias = translations[withoutPrefix.toLowerCase()];
      // Shared resolver: understands both `mdi:*` (Home Assistant Material
      // Design Icons) and plain Lucide names, unlike the old Lucide-only lookup.
      const resolved = getDashboardIconComponent(alias ?? raw);
      if (resolved !== Icons.CircleHelp) return resolved;
    }

    if (index === 0) return Icons.Home;
    if (index === 1) return Icons.LayoutGrid;
    return Icons.BriefcaseBusiness;
  };

  return (
    <div className="border-b border-border/60">
      <div className="flex min-h-12 items-center gap-0 overflow-x-auto no-scrollbar px-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary lg:hidden"
            aria-label={t('shell.toggle_sidebar')}
            title={t('shell.toggle_sidebar')}
          >
            <Icons.Menu className="h-5 w-5" />
          </button>
        )}
        {tabs.map((tab, index) => {
          const Icon = getTabIcon(tab, index);
          const isActive = activeTabIdx === index;
          return (
            <div key={tab.id} className="group flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onSelectTab(index)}
                  className={cn(
                    "flex h-14 min-w-20 items-center justify-center gap-2 border-b-2 px-3 text-caption font-semibold transition-all sm:min-w-28",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.title}</span>
                </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(index);
                    onConfigureTab(index);
                  }}
                  className={cn(
                    "mr-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-primary",
                    isActive && "bg-primary/15 text-primary"
                  )}
                  aria-label={`${configureLabel}: ${tab.title}`}
                  title={configureLabel}
                >
                  <Icons.Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {isAddingTab && (
          <InlineTabCreator placeholder={placeholder} onConfirm={onAddTab} onCancel={onCancelAddingTab} />
        )}
        {!isAddingTab && onStartAddingTab && (
          <button
            type="button"
            onClick={onStartAddingTab}
            className={cn(
              "ml-1 flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-caption font-semibold tracking-tight normal-case transition-colors",
              isEditing
                ? "border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={addLabel}
            aria-label={addLabel}
          >
            <Icons.Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        )}
        
        {/* Fill available space to push the edit button to the right */}
        <div className="flex-1" />

        {/* Edit Button (HA Style) when not editing */}
        {!isEditing && onToggleEditing && (
          <button
            type="button"
            onClick={onToggleEditing}
            className="ml-auto mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-primary"
            title={editLabel}
            aria-label={editLabel}
          >
            <Icons.Pencil className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};
