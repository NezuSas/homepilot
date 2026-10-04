import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';
import { getDashboardIconComponent } from '../components/IconPicker';
import { getDefaultIcon, normalizeKind, type SectionCardIcon, type SectionCardKind } from './sectionCardCatalog';
import { getLightTileIconClasses, getLightTileSurfaceClasses, SECTION_BUTTON_TILE_CLASSES } from './SectionDeviceCard';

interface SectionActionCardProps {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  isActive?: boolean;
  isPreview?: boolean;
  isEditorPreview?: boolean;
  onAction?: () => void;
  actionFeedback?: 'pending' | 'success' | 'error';
  isBlocked?: boolean;
  ariaLabel?: string;
  pressed?: boolean;
  momentaryCommand?: boolean;
  actionError?: string;
}

export function SectionActionCard({
  kind,
  title,
  subtitle,
  icon,
  isAssigned,
  isActive,
  isPreview,
  isEditorPreview,
  onAction,
  actionFeedback,
  isBlocked,
  ariaLabel,
  pressed,
  momentaryCommand,
  actionError,
}: SectionActionCardProps) {
  const { t } = useTranslation();
  const Icon = getDashboardIconComponent(icon ?? getDefaultIcon(normalizeKind(kind)));
  const isPresentationOnly = Boolean(isPreview || isEditorPreview);
  const unavailable = !isAssigned || !onAction;
  const isInteractiveAction = !isPresentationOnly && !unavailable;

  return (
    <Button
      type="button"
      onClick={(event) => { event.stopPropagation(); onAction?.(); }}
      disabled={!isPresentationOnly && (unavailable || isBlocked || actionFeedback === 'pending')}
      aria-disabled={!isInteractiveAction || isBlocked || actionFeedback === 'pending' || undefined}
      aria-busy={actionFeedback === 'pending' || undefined}
      aria-label={ariaLabel ?? t('dashboard.editor.sections.action_button_aria', { name: title })}
      aria-pressed={momentaryCommand ? undefined : pressed}
      data-plc-momentary={momentaryCommand || undefined}
      data-action-state={momentaryCommand ? actionFeedback === 'pending' ? 'pending' : 'idle' : actionFeedback ?? 'idle'}
      title={actionError ?? (actionFeedback === 'error' ? t('dashboard.editor.sections.action_button_error') : unavailable ? t('dashboard.editor.sections.action_button_unavailable') : subtitle)}
      variant="ghost"
      className={cn(
        SECTION_BUTTON_TILE_CLASSES,
        getLightTileSurfaceClasses(Boolean(isActive)),
        'px-2.5 py-2.5 active:scale-[0.985] focus-visible:ring-primary/70 disabled:cursor-default',
        isActive ? 'hover:bg-transparent' : 'hover:bg-card/95',
        unavailable && !isPresentationOnly ? 'disabled:opacity-60' : 'disabled:opacity-100',
        isPresentationOnly && 'pointer-events-none cursor-default',
      )}
    >
      <Icon aria-hidden="true" className={getLightTileIconClasses(Boolean(isActive))} />
      <span className="line-clamp-2 min-w-0 text-micro font-bold leading-tight text-foreground">{title}</span>
      {momentaryCommand && <span className="min-w-0 text-micro text-muted-foreground">{t(actionFeedback === 'pending' ? 'dashboards.widgets.action_button.pending' : 'dashboards.widgets.action_button.execute')}</span>}
      {momentaryCommand && actionFeedback === 'error' && <span role="alert" className="line-clamp-2 min-w-0 text-micro text-danger">{actionError ?? t('dashboard.editor.sections.action_button_error')}</span>}
      {actionFeedback === 'success' && <span role="status" className="sr-only">{t('dashboard.editor.sections.action_button_success')}</span>}
      {!momentaryCommand && actionFeedback === 'error' && <span role="alert" className="sr-only">{t('dashboard.editor.sections.action_button_error')}</span>}
    </Button>
  );
}
