import type { ComponentType, ReactNode, RefObject } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Heading } from '../../../components/ui/Heading';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { EditableInformationCard, InformationCard } from './InformationCard';
import type { NormalizedSectionCardItem } from './sectionCardCatalog';

interface SectionHeadingProps {
  title: string;
  showTitle: boolean;
  isEditing: boolean;
  Icon: ComponentType<{ className?: string }> | null;
}

/** Section title, or the editing-only "untitled" hint when the title is hidden. */
export function SectionHeading({ title, showTitle, isEditing, Icon }: SectionHeadingProps) {
  const { t } = useTranslation();
  if (showTitle) {
    return (
      <Heading as="h2" variant="section" className="homepilot-dashboard-section-heading flex w-fit max-w-full items-center gap-2 truncate rounded-lg px-2 py-1 text-dashboard-section-title-fluid font-black">
        {Icon && <Icon className="homepilot-dashboard-section-heading-icon h-5 w-5 shrink-0" />}
        <span className="truncate">{title}</span>
      </Heading>
    );
  }
  return isEditing ? (
    <span className="pointer-events-none absolute -top-5 left-1 text-body font-semibold text-muted-foreground">
      {t('dashboard.editor.sections.untitled_section')}
    </span>
  ) : null;
}

/** Twelve-column masonry grid that hosts a section's cards. */
export function SectionCardGrid({ gridRef, children }: { gridRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <div
      ref={gridRef}
      data-section-card-grid="true"
      onClick={(event) => event.stopPropagation()}
      className="grid min-h-0 min-w-0 flex-1 grid-cols-12 content-start items-start gap-2 overflow-visible pr-1 auto-rows-[minmax(20px,auto)] grid-flow-row-dense"
    >
      {children}
    </div>
  );
}

/** Editing-only floating button that opens the card catalog. */
export function SectionAddCardButton({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="absolute -top-5 left-3 z-30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('dashboard.editor.sections.add_card')}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
        title={t('dashboard.editor.sections.add_card')}
        className="w-11 border border-border/50 bg-background text-primary hover:bg-primary/10"
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
      </Button>
    </div>
  );
}

interface SectionBadgeRowProps {
  cards: NormalizedSectionCardItem[];
  devices: SnapshotDevice[];
  isEditing: boolean;
  onEditCard: (card: NormalizedSectionCardItem) => void;
  onAdd: () => void;
  /** Modals owned by the section, rendered inside the row like the original markup. */
  children: ReactNode;
}

/** Compact row of information pills used by sections flagged as a badge row. */
export function SectionBadgeRow({ cards, devices, isEditing, onEditCard, onAdd, children }: SectionBadgeRowProps) {
  const { t } = useTranslation();
  return (
    <div data-dashboard-badge-row className="flex min-w-0 flex-wrap items-center gap-2">
      {cards.filter(card => isEditing || !card.hidden).map(card => <EditableInformationCard key={card.id} isEditing={isEditing} onEdit={() => onEditCard(card)}>
        <InformationCard pill source={card.kind === 'info_time' ? 'info_time' : card.kind === 'info_weather' ? 'info_weather' : 'info_sensor'} title={card.title} icon={card.icon} device={devices.find(device => device.id === card.entityId && device.roomId !== null)} />
      </EditableInformationCard>)}
      {isEditing && <Button variant="ghost" className="border border-dashed border-border text-muted-foreground" onClick={onAdd}><Plus className="size-4" aria-hidden="true" />{t('dashboard.editor.sections.add_labels')}</Button>}
      {children}
    </div>
  );
}
