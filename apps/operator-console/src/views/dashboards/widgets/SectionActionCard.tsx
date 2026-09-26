import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';
import { getDashboardIconComponent } from '../components/IconPicker';
import { getDefaultIcon, normalizeKind, type SectionCardIcon, type SectionCardKind } from './sectionCardCatalog';
import { SECTION_COMPACT_TILE_CLASSES, SECTION_COMPACT_TILE_INACTIVE_CLASSES } from './SectionDeviceCard';

interface SectionActionCardProps {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  isPreview?: boolean;
  isEditorPreview?: boolean;
  onAction?: () => void;
  actionFeedback?: 'pending' | 'success' | 'error';
}

export function SectionActionCard({
  kind,
  title,
  subtitle,
  icon,
  isAssigned,
  isPreview,
  isEditorPreview,
  onAction,
  actionFeedback,
}: SectionActionCardProps) {
  const { t } = useTranslation();
  const Icon = getDashboardIconComponent(icon ?? getDefaultIcon(normalizeKind(kind)));
  const actionLabel = actionFeedback === 'pending'
    ? t('dashboard.editor.sections.action_button_pending')
    : actionFeedback === 'success'
      ? t('dashboard.editor.sections.action_button_success')
      : actionFeedback === 'error'
        ? t('dashboard.editor.sections.action_button_error')
        : t('dashboard.editor.sections.action_button_execute');
  const isPresentationOnly = Boolean(isPreview || isEditorPreview);
  const unavailable = !isAssigned || !onAction;
  const isInteractiveAction = !isPresentationOnly && !unavailable;

  return (
    <Button
      type="button"
      onClick={(event) => { event.stopPropagation(); onAction?.(); }}
      disabled={!isPresentationOnly && (unavailable || actionFeedback === 'pending')}
      aria-disabled={!isInteractiveAction || actionFeedback === 'pending' || undefined}
      aria-busy={actionFeedback === 'pending' || undefined}
      aria-label={t('dashboard.editor.sections.action_button_aria', { name: title })}
      title={unavailable ? t('dashboard.editor.sections.action_button_unavailable') : subtitle}
      variant="ghost"
      className={cn(
        SECTION_COMPACT_TILE_CLASSES,
        SECTION_COMPACT_TILE_INACTIVE_CLASSES,
        'gap-1 px-2.5 py-2.5 hover:border-primary/40 hover:bg-card focus-visible:ring-primary/70 disabled:cursor-default disabled:opacity-65',
        isPresentationOnly && 'pointer-events-none cursor-default',
        actionFeedback === 'pending' && 'border-primary/50',
        actionFeedback === 'success' && 'border-success/50',
        actionFeedback === 'error' && 'border-danger/50',
      )}
    >
      {actionFeedback === 'pending' ? <Loader2 aria-hidden="true" className="h-7 w-7 shrink-0 animate-spin text-primary" />
        : actionFeedback === 'success' ? <Check aria-hidden="true" className="h-7 w-7 shrink-0 text-success" />
          : actionFeedback === 'error' ? <CircleAlert aria-hidden="true" className="h-7 w-7 shrink-0 text-danger" />
            : <Icon aria-hidden="true" className="h-7 w-7 shrink-0 text-muted-foreground" />}
      <span className="line-clamp-2 min-w-0 text-micro font-bold leading-tight text-foreground">{title}</span>
      {actionFeedback && <span role="status" className={cn('line-clamp-1 text-nano font-semibold', actionFeedback === 'success' ? 'text-success' : actionFeedback === 'error' ? 'text-danger' : 'text-primary')}>{actionLabel}</span>}
    </Button>
  );
}
