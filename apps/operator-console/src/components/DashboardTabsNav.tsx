import * as Icons from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { Dashboard } from '../views/dashboards/types';
import { InlineTabCreator } from './InlineTabCreator';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { getDashboardIconComponent, useMdiCatalogLoaded } from '../views/dashboards/components/IconPicker';

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
  // The MDI icon set loads lazily; this re-renders once it's ready so an
  // already-saved mdi:* tab icon resolves instead of staying on its fallback.
  useMdiCatalogLoaded();

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
          <IconButton icon={Icons.Menu} label={t('shell.toggle_sidebar')} onClick={onOpenMobileMenu} variant="default" size="md" className="mr-1 rounded-full bg-card/80 shadow-sm backdrop-blur-md lg:hidden" />
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
                  variant="ghost"
                  size="md"
                  className={cn(
                    "h-14 min-w-20 justify-center gap-2 rounded-none border-b-2 px-3 text-caption font-semibold sm:min-w-28",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.title}</span>
                </Button>
              {isEditing && (
                <IconButton
                  icon={Icons.Pencil}
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
            <Icons.Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{addLabel}</span>
          </Button>
        )}
        
        {/* Fill available space to push the edit button to the right */}
        <div className="flex-1" />

        {/* Edit Button (HA Style) when not editing */}
        {!isEditing && onToggleEditing && (
          <IconButton icon={Icons.Pencil} label={editLabel ?? addLabel} onClick={onToggleEditing} variant="ghost" size="md" className="ml-auto mr-1 rounded-full" />
        )}
      </div>
    </div>
  );
};
