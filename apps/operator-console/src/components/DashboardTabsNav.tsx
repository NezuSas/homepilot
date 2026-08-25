import { BriefcaseBusiness, CircleHelp, Home, LayoutGrid, Menu, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { Dashboard } from '../views/dashboards/types';
import { InlineTabCreator } from './InlineTabCreator';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { getDashboardIconComponent, needsMdiCatalog, useMdiCatalogLoaded } from '../views/dashboards/components/IconPicker';

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
  onCancelAddingTab
}) => {
  const { t } = useTranslation();
  // Load the complete MDI catalog only when a tab needs a custom icon outside
  // the bundled HomePilot icon baseline.
  useMdiCatalogLoaded(tabs.some((tab) => needsMdiCatalog(tab.icon)));

  const getTabIcon = (tab: Dashboard['tabs'][number], index: number) => {
    if (tab.icon) {
      const raw = tab.icon.trim();
      const withoutPrefix = raw.replace(/^mdi:/i, '');

      // Legacy Spanish aliases stored before the shared MDI+Lucide catalog
      // existed; kept so previously saved tab icons keep resolving.
      const translations: Record<string, string> = {
        gata: 'mdi:cat', gato: 'mdi:cat', perro: 'mdi:dog', perra: 'mdi:dog',
        luz: 'mdi:lightbulb', foco: 'mdi:lightbulb', interruptor: 'mdi:power',
        enchufe: 'mdi:power-plug', camara: 'mdi:camera', tv: 'mdi:television', musica: 'mdi:music',
        bocina: 'mdi:speaker', parlante: 'mdi:speaker', llave: 'mdi:key',
        candado: 'mdi:lock', escudo: 'mdi:shield', termometro: 'mdi:thermometer',
        aire: 'mdi:weather-windy', ventilador: 'mdi:fan'
      };

      const alias = translations[withoutPrefix.toLowerCase()];
      // Shared resolver: understands both `mdi:*` (Home Assistant Material
      // Design Icons) and plain Lucide names, unlike the old Lucide-only lookup.
      const resolved = getDashboardIconComponent(alias ?? raw);
      if (resolved !== CircleHelp) return resolved;
    }

    if (index === 0) return Home;
    if (index === 1) return LayoutGrid;
    return BriefcaseBusiness;
  };

  return (
    <div className="homepilot-dashboard-tabs min-w-0">
      <div className="flex min-h-12 min-w-0 items-center gap-0 overflow-x-auto px-3 no-scrollbar">
        {onOpenMobileMenu && (
          <IconButton icon={Menu} label={t('shell.toggle_sidebar')} onClick={onOpenMobileMenu} variant="default" size="md" className="mr-1 rounded-full bg-card/90 shadow-depth-1 backdrop-blur-md xl:hidden" />
        )}
        {tabs.map((tab, index) => {
          const Icon = getTabIcon(tab, index);
          const isActive = activeTabIdx === index;
          return (
            <div key={tab.id} className="group flex shrink-0 items-center">
                <Button
                  type="button"
                  onClick={() => onSelectTab(index)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={tab.title}
                  title={tab.title}
                  variant="ghost"
                  size="md"
                  className={cn(
                    "h-14 min-w-20 justify-center gap-2 rounded-none border px-3 text-caption font-semibold sm:min-w-28",
                    isActive
                      ? "relative border-primary bg-primary/10 text-primary hover:border-primary before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="max-w-28 truncate sm:max-w-44">{tab.title}</span>
                </Button>
              {isEditing && (
                <IconButton
                  icon={Pencil}
                  label={`${configureLabel}: ${tab.title}`}
                  onClick={() => {
                    onSelectTab(index);
                    onConfigureTab(index);
                  }}
                  variant="ghost"
                  size="md"
                  className={cn("mr-1 rounded-full", isActive && "bg-primary/15 text-primary")}
                />
              )}
            </div>
          );
        })}
        {isAddingTab && (
          <InlineTabCreator placeholder={placeholder} confirmLabel={t('common.confirm')} cancelLabel={t('common.cancel')} onConfirm={onAddTab} onCancel={onCancelAddingTab} />
        )}
        {!isAddingTab && onStartAddingTab && (
          <Button
            type="button"
            onClick={onStartAddingTab}
            variant={isEditing ? 'primary' : 'secondary'}
            size="sm"
            className="ml-1 shrink-0 rounded-full"
            title={addLabel}
            aria-label={addLabel}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{addLabel}</span>
          </Button>
        )}
        
      </div>
    </div>
  );
};
