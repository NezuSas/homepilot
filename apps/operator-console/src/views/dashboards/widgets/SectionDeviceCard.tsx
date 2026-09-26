import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import { getDashboardIconComponent } from '../components/IconPicker';
import { getDefaultIcon, normalizeKind, type SectionCardIcon, type SectionCardKind } from './sectionCardCatalog';

export const SECTION_COMPACT_TILE_CLASSES = 'relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-xl border p-2.5 text-center text-foreground transition-all';
export const SECTION_COMPACT_TILE_INACTIVE_CLASSES = 'border-border/60 bg-card/95 shadow-surface-card';

export function getLightTileSurfaceClasses(isActive: boolean, isPreview = false) {
  return isActive
    ? isPreview ? 'homepilot-section-light-tile-active' : 'homepilot-section-light-tile-surface'
    : SECTION_COMPACT_TILE_INACTIVE_CLASSES;
}

export function getLightTileIconClasses(isActive: boolean) {
  return cn('h-7 w-7 shrink-0 transition-colors', isActive ? 'text-light-active' : 'text-muted-foreground');
}

interface SectionDeviceCardProps {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  isActive?: boolean;
  isPreview?: boolean;
}

export function SectionDeviceCard({ kind, title, subtitle, icon, isAssigned, isActive, isPreview }: SectionDeviceCardProps) {
  const { t } = useTranslation();
  const normalized = normalizeKind(kind);
  const Icon = getDashboardIconComponent(icon ?? getDefaultIcon(normalized));
  const isLightKind = normalized === 'light';
  const isTileKind = normalized === 'light' || normalized === 'device';

  if (isTileKind) {
    return (
      <div className={cn(SECTION_COMPACT_TILE_CLASSES, isLightKind ? getLightTileSurfaceClasses(Boolean(isActive), isPreview) : isActive ? 'border-primary/45 bg-primary/14 shadow-surface-card' : SECTION_COMPACT_TILE_INACTIVE_CLASSES)}>
        <Icon className={isLightKind ? getLightTileIconClasses(Boolean(isActive)) : cn('h-7 w-7 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} />
        <span className="line-clamp-2 min-w-0 text-micro font-bold leading-tight text-foreground">{title}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-section border p-3 text-center text-foreground transition-all sm:p-4', isActive ? 'border-primary/80 bg-primary/20 shadow-primary-warm ring-2 ring-primary/30 dark:bg-device-active-dark' : 'border-border/60 bg-card/95 shadow-surface-card ring-1 ring-background/45')}>
      <span className={cn('mb-2 grid h-24 w-24 place-items-center rounded-full transition-all sm:mb-3', isActive ? 'bg-primary text-primary-foreground shadow-primary-room-icon ring-1 ring-primary/35' : 'bg-muted/65 text-muted-foreground ring-1 ring-border/40')}><Icon className="h-20 w-20" /></span>
      <span className="line-clamp-2 min-w-0 text-body font-black leading-tight text-foreground">{title}</span>
      {!isAssigned ? <span className="mt-1 line-clamp-2 text-micro font-bold leading-tight text-muted-foreground">{subtitle || t('dashboard.editor.sections.unassigned')}</span> : null}
    </div>
  );
}
