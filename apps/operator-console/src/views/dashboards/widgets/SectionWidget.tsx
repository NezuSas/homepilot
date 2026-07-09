import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  GripVertical,
  Home,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig, WidgetType } from '../types';
import { IconPicker, getLucideIconComponent } from '../components/IconPicker';
import { DashboardSelect } from '../components/DashboardSelect';
import { ClockWidget, type ClockStyle } from './clock';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

type SectionCardKind =
  | 'device'
  | 'light'
  | 'cover'
  | 'camera'
  | 'room'
  | 'scene'
  | 'clock'
  | 'clock_digital'
  | 'clock_analog'
  | 'clock_premium'
  | 'clock_minimal'
  | 'energy'
  | 'assistant'
  | 'system';

type NormalizedSectionCardKind = Exclude<SectionCardKind, 'clock'>;
type SectionCardSpan = 'small' | 'medium' | 'full';
type SectionCardIcon = string;

interface SectionCardItem {
  id: string;
  kind: SectionCardKind;
  title: string;
  description?: string;
  widgetType?: WidgetType;
  entityId?: string;
  entityName?: string;
  span?: SectionCardSpan;
  icon?: SectionCardIcon;
}

interface NormalizedSectionCardItem extends Omit<SectionCardItem, 'kind'> {
  kind: NormalizedSectionCardKind;
}

interface CardDraft {
  title: string;
  kind: NormalizedSectionCardKind;
  entityId: string;
  span: SectionCardSpan;
  icon: SectionCardIcon;
}

const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cardKinds: NormalizedSectionCardKind[] = [
  'device',
  'light',
  'cover',
  'camera',
  'room',
  'scene',
  'clock_digital',
  'clock_analog',
  'clock_premium',
  'clock_minimal',
  'energy',
  'assistant',
  'system',
];

function normalizeKind(kind: SectionCardKind): NormalizedSectionCardKind {
  return kind === 'clock' ? 'clock_digital' : kind;
}

function isClockKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'clock_digital' || normalized === 'clock_analog' || normalized === 'clock_premium' || normalized === 'clock_minimal';
}

function getDefaultSpan(kind: SectionCardKind): SectionCardSpan {
  const normalized = normalizeKind(kind);
  if (normalized === 'light' || normalized === 'device' || normalized === 'cover') return 'small';
  if (isClockKind(normalized)) return normalized === 'clock_minimal' ? 'medium' : 'full';
  if (normalized === 'camera') return 'medium';
  return 'medium';
}

const clockCardOptions: { kind: NormalizedSectionCardKind; style: ClockStyle; label: string }[] = [
  { kind: 'clock_premium', style: 'analog-classic', label: 'Analógico premium' },
  { kind: 'clock_digital', style: 'digital', label: 'Digital compacto' },
  { kind: 'clock_analog', style: 'minimal', label: 'Digital residencial' },
  { kind: 'clock_minimal', style: 'analog-minimal', label: 'Analógico minimal' },
];

function getClockStyleFromKind(kind: SectionCardKind): ClockStyle {
  const normalized = normalizeKind(kind);
  return clockCardOptions.find((option) => option.kind === normalized)?.style ?? 'analog-classic';
}

function getClockKindLabel(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return clockCardOptions.find((option) => option.kind === normalized)?.label ?? 'Analógico premium';
}

function getClockPreviewScale(span: SectionCardSpan) {
  switch (span) {
    case 'small':
      return 0.36;
    case 'medium':
      return 0.46;
    case 'full':
    default:
      return 0.52;
  }
}

function getDefaultIcon(kind: SectionCardKind): SectionCardIcon {
  const normalized = normalizeKind(kind);
  if (normalized === 'camera') return 'camera';
  if (normalized === 'system') return 'wifi';
  if (normalized === 'scene') return 'power';
  if (normalized === 'cover') return 'sun';
  if (normalized === 'device') return 'power';
  return 'lightbulb';
}

function getSpanCols(span: SectionCardSpan) {
  switch (span) {
    case 'small':
      return 2;
    case 'full':
      return 6;
    case 'medium':
    default:
      return 3;
  }
}

function getSpanClass(span: SectionCardSpan) {
  switch (span) {
    case 'small':
      return 'col-span-2';
    case 'full':
      return 'col-span-6';
    case 'medium':
    default:
      return 'col-span-3';
  }
}

function getWidgetType(kind: SectionCardKind): WidgetType {
  const normalized = normalizeKind(kind);

  switch (normalized) {
    case 'room':
      return 'room_overview' as WidgetType;
    case 'scene':
      return 'scene_shortcut' as WidgetType;
    case 'energy':
      return 'energy_snapshot' as WidgetType;
    case 'assistant':
      return 'assistant_insight' as WidgetType;
    case 'system':
      return 'system_status' as WidgetType;
    case 'device':
    case 'light':
    case 'cover':
    case 'camera':
    default:
      return 'device_control' as WidgetType;
  }
}

function getCatalogLabelKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'device':
      return 'dashboard.editor.sections.section_card_device';
    case 'light':
      return 'dashboard.editor.sections.section_card_light';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera';
    case 'room':
      return 'dashboard.editor.sections.section_card_room';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene';
    case 'clock_digital':
      return 'dashboard.editor.sections.section_card_clock_digital';
    case 'clock_analog':
      return 'dashboard.editor.sections.section_card_clock_analog';
    case 'clock_premium':
      return 'dashboard.editor.sections.section_card_clock_premium';
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock_minimal';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant';
    case 'system':
      return 'dashboard.editor.sections.section_card_system';
  }
}

function getCatalogDescriptionKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'device':
      return 'dashboard.editor.sections.section_card_device_desc';
    case 'light':
      return 'dashboard.editor.sections.section_card_light_desc';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover_desc';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera_desc';
    case 'room':
      return 'dashboard.editor.sections.section_card_room_desc';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene_desc';
    case 'clock_digital':
      return 'dashboard.editor.sections.section_card_clock_digital_desc';
    case 'clock_analog':
      return 'dashboard.editor.sections.section_card_clock_analog_desc';
    case 'clock_premium':
      return 'dashboard.editor.sections.section_card_clock_premium_desc';
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock_minimal_desc';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy_desc';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant_desc';
    case 'system':
      return 'dashboard.editor.sections.section_card_system_desc';
  }
}

function normalizeCards(extra: DashboardWidgetConfig['extra']): NormalizedSectionCardItem[] {
  const rawCards = extra?.cards;
  if (!Array.isArray(rawCards)) return [];

  return rawCards
    .filter((card): card is SectionCardItem => {
      if (!card || typeof card !== 'object') return false;
      const candidate = card as Partial<SectionCardItem>;
      return typeof candidate.id === 'string' && typeof candidate.kind === 'string';
    })
    .map((card) => {
      const kind = normalizeKind(card.kind);
      return {
        ...card,
        kind,
        title: typeof card.title === 'string' && card.title.trim() ? card.title : kind,
        widgetType: card.widgetType ?? getWidgetType(kind),
        span: card.span ?? getDefaultSpan(kind),
        icon: card.icon ?? getDefaultIcon(kind),
      };
    });
}

function getRecommendedSectionHeight(currentHeight: number, cards: NormalizedSectionCardItem[]) {
  const spans = [
    ...cards.map((card) => getSpanCols(card.span ?? getDefaultSpan(card.kind))),
    3,
  ];

  let rows = 1;
  let used = 0;

  for (const cols of spans) {
    if (used + cols > 6) {
      rows += 1;
      used = 0;
    }

    used += cols;

    if (used >= 6) {
      rows += 1;
      used = 0;
    }
  }

  const effectiveRows = Math.max(1, used === 0 ? rows - 1 : rows);
  const recommended = Math.max(4, 1 + effectiveRows * 3);
  return Math.max(currentHeight || 4, recommended);
}

function isBindableKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'device' || normalized === 'light' || normalized === 'cover' || normalized === 'camera';
}

function iconForIconKey(icon: SectionCardIcon) {
  return getLucideIconComponent(icon);
}

function CardPreview({
  kind,
  title,
  subtitle,
  span,
  icon,
  isAssigned,
}: {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  span: SectionCardSpan;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
}) {
  const normalized = normalizeKind(kind);
  const Icon = iconForIconKey(icon ?? getDefaultIcon(normalized));
  const isSmall = span === 'small';

  if (isClockKind(normalized)) {
    const scale = getClockPreviewScale(span);

    return (
      <div className="relative h-full min-h-[10.5rem] w-full overflow-hidden rounded-[1.35rem] border border-border/40 bg-background shadow-sm">
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 620,
            height: 320,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center',
          }}
        >
          <ClockWidget
            config={{
              layout: {
                x: 0,
                y: 0,
                w: 6,
                h: 4,
              },
              binding: {
                entityId: '',
                entityType: 'system',
              },
              visibility: {
                rules: [],
                defaultState: 'show',
              },
              appearance: {
                title,
                showTitle: false,
              },
              extra: {
                clockStyle: getClockStyleFromKind(normalized),
              },
            }}
          />
        </div>
      </div>
    );
  }

  if (normalized === 'camera') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden rounded-[1.35rem] border border-border/45 bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(234,88,12,0.26),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-black text-foreground">
            ● En vivo
          </span>
        </div>
        <div className="absolute inset-x-3 top-12 bottom-14 overflow-hidden rounded-xl border border-border/35 bg-background/45">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-muted/30 to-background" />
          <div className="absolute left-4 top-4 h-8 w-16 rounded bg-background/35" />
          <div className="absolute bottom-4 left-4 h-10 w-20 rounded bg-background/40" />
          <div className="absolute bottom-4 right-4 h-14 w-14 rounded-full bg-primary/20" />
          <Camera className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-foreground/65" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="line-clamp-1 text-sm font-black text-foreground">{title}</div>
          <div className="mt-1 line-clamp-1 text-xs font-semibold text-muted-foreground">{subtitle || 'Vista de cámara'}</div>
        </div>
      </div>
    );
  }

  if (normalized === 'energy') {
    return (
      <div className="flex h-full min-h-0 flex-col justify-between rounded-[1.35rem] border border-border/45 bg-card p-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Energía</span>
        <div>
          <span className="text-4xl font-black text-foreground">1.8</span>
          <span className="ml-1 text-sm font-black text-muted-foreground">kW</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full w-[64%] rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (normalized === 'room') {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.35rem] border border-border/45 bg-card p-4">
        <span className="mb-3 grid h-9 w-9 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Home className="h-5 w-5" />
        </span>
        <span className="text-lg font-black text-foreground">{title}</span>
        <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">1 activo · 7 equipos</span>
      </div>
    );
  }

  if (normalized === 'scene') {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/45 bg-gradient-to-br from-primary/15 to-card p-4 text-center">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-primary/30 text-primary">
          <Monitor className="h-6 w-6" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Escena</span>
        <span className="mt-3 text-sm font-black text-foreground">{title}</span>
      </div>
    );
  }

  if (normalized === 'assistant' || normalized === 'system') {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.35rem] border border-border/45 bg-card p-4">
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-black text-foreground">{title}</span>
        <span className="mt-3 h-2 w-3/4 rounded-full bg-primary/30" />
        <span className="mt-2 h-2 w-1/2 rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/45 bg-card p-4 text-center">
      <span className={cn("mb-3 grid place-items-center rounded-full bg-primary/10 text-primary", isSmall ? "h-16 w-16" : "h-24 w-24")}>
        <Icon className={cn(isSmall ? "h-9 w-9" : "h-14 w-14")} />
      </span>
      <span className="line-clamp-1 text-sm font-black text-foreground">{title}</span>
      {!isSmall ? (
        <span className="mt-1 line-clamp-1 text-[10px] font-bold text-muted-foreground">
          {subtitle || (isAssigned ? 'Asignado' : 'Sin asignar')}
        </span>
      ) : null}
    </div>
  );
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();
  const devices = useDeviceSnapshotStore((state) => state.devices);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.appearance?.title || '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb' });

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  const catalogItems = useMemo(() => cardKinds.map((kind) => ({
    kind,
    title: t(getCatalogLabelKey(kind)),
    description: t(getCatalogDescriptionKey(kind)),
    widgetType: getWidgetType(kind),
    span: getDefaultSpan(kind),
    icon: getDefaultIcon(kind),
  })), [t]);

  const filteredCatalog = catalogItems.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return `${item.title} ${item.description}`.toLowerCase().includes(normalizedQuery);
  });

  const filteredDevices = devices.filter((device) => {
    if (cardDraft.kind === 'camera') {
      return device.type === 'camera' || device.semanticType === 'camera';
    }

    if (cardDraft.kind === 'light') {
      return device.type === 'light' || device.semanticType === 'light' || device.type === 'switch' || device.semanticType === 'switch';
    }

    if (cardDraft.kind === 'cover') {
      return device.type === 'cover' || device.semanticType === 'cover';
    }

    return true;
  });

  const updateCards = (nextCards: NormalizedSectionCardItem[]) => {
    onUpdate?.({
      layout: {
        ...config.layout,
        h: getRecommendedSectionHeight(config.layout.h, nextCards),
      },
      extra: {
        ...config.extra,
        cards: nextCards,
      },
    });
  };

  const addCard = (item: typeof catalogItems[number]) => {
    const nextCard: NormalizedSectionCardItem = {
      id: createId(),
      kind: item.kind,
      title: item.title,
      description: item.description,
      widgetType: item.widgetType,
      span: item.span,
      icon: item.icon,
    };

    updateCards([...cards, nextCard]);
    setIsCatalogOpen(false);
    setQuery('');

    setEditingCardId(nextCard.id);
    const nextIcon = nextCard.icon ?? getDefaultIcon(nextCard.kind);
    setCardDraft({
      title: nextCard.title,
      kind: nextCard.kind,
      entityId: '',
      span: nextCard.span ?? getDefaultSpan(nextCard.kind),
      icon: nextIcon,
    });
  };

  const openCardEditor = (card: NormalizedSectionCardItem) => {
    setEditingCardId(card.id);
    const nextIcon = card.icon ?? getDefaultIcon(card.kind);
    setCardDraft({
      title: card.title,
      kind: card.kind,
      entityId: card.entityId || '',
      span: card.span ?? getDefaultSpan(card.kind),
      icon: nextIcon,
    });
  };

  const saveCardEditor = () => {
    if (!editingCard) return;

    const selectedDevice = devices.find((device) => device.id === cardDraft.entityId);
    const nextCards = cards.map((card) => {
      if (card.id !== editingCard.id) return card;

      return {
        ...card,
        kind: cardDraft.kind,
        title: cardDraft.title.trim() || selectedDevice?.name || t(getCatalogLabelKey(cardDraft.kind)),
        description: t(getCatalogDescriptionKey(cardDraft.kind)),
        widgetType: getWidgetType(cardDraft.kind),
        entityId: cardDraft.entityId || undefined,
        entityName: selectedDevice?.name,
        span: cardDraft.span,
        icon: cardDraft.icon,
      };
    });

    updateCards(nextCards);
    setEditingCardId(null);
  };

  const removeCard = (id: string) => {
    updateCards(cards.filter((card) => card.id !== id));
  };

  const moveCard = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const sourceIndex = cards.findIndex((card) => card.id === sourceId);
    const targetIndex = cards.findIndex((card) => card.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextCards = [...cards];
    const [moved] = nextCards.splice(sourceIndex, 1);
    nextCards.splice(targetIndex, 0, moved);

    updateCards(nextCards);
  };

  const saveTitle = () => {
    const nextTitle = draftTitle.trim() || t('dashboard.editor.sections.new_section');
    onUpdate?.({
      appearance: {
        ...config.appearance,
        title: nextTitle,
      },
    });
    setIsEditingTitle(false);
  };

  const renderCard = (card: NormalizedSectionCardItem) => {
    const span = card.span ?? getDefaultSpan(card.kind);
    const subtitle = card.entityName || card.description;

    return (
      <div
        key={card.id}
        draggable={isEditing}
        onDragStart={(event) => {
          event.stopPropagation();
          setDraggingCardId(card.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', card.id);
        }}
        onDragOver={(event) => {
          if (!isEditing || !draggingCardId || draggingCardId === card.id) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = event.dataTransfer.getData('text/plain') || draggingCardId;
          if (sourceId) moveCard(sourceId, card.id);
          setDraggingCardId(null);
        }}
        onDragEnd={() => setDraggingCardId(null)}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "group/card relative min-h-[10.5rem] overflow-hidden rounded-[1.35rem] shadow-sm transition-all",
          draggingCardId === card.id && "opacity-45",
          getSpanClass(span)
        )}
      >
        <CardPreview
          kind={card.kind}
          title={card.title}
          subtitle={subtitle}
          span={span}
          icon={card.icon}
          isAssigned={Boolean(card.entityId)}
        />

        {isEditing ? (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
            <span
              className="grid h-8 w-8 cursor-grab place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg active:cursor-grabbing"
              title="Mover tarjeta"
              onClick={(event) => event.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openCardEditor(card);
              }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg transition hover:text-primary"
              aria-label="Edit card"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeCard(card.id);
              }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg transition hover:text-destructive"
              aria-label="Remove card"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCatalogPreview = (kind: NormalizedSectionCardKind, titleOverride?: string, spanOverride?: SectionCardSpan, iconOverride?: SectionCardIcon) => {
    const title = titleOverride || t(getCatalogLabelKey(kind));
    const span = spanOverride ?? getDefaultSpan(kind);

    return (
      <div className={cn("overflow-hidden rounded-[1.5rem] bg-background/40", span === 'small' ? 'h-36' : 'h-44')}>
        <CardPreview
          kind={kind}
          title={title}
          subtitle={t(getCatalogDescriptionKey(kind))}
          span={span}
          icon={iconOverride ?? getDefaultIcon(kind)}
        />
      </div>
    );
  };

  const catalogModal = isCatalogOpen ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99990] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
        onClick={() => setIsCatalogOpen(false)}
      >
        <div
          className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
                {t('dashboard.editor.sections.add_card')}
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground">
                {t('dashboard.editor.sections.card_catalog_title')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('dashboard.editor.sections.card_catalog_search')}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/55"
              />
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-6">
            {filteredCatalog.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => addCard(item)}
                    className="rounded-[1.75rem] border border-border/50 bg-background/30 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    {renderCatalogPreview(item.kind, item.title, item.span, item.icon)}
                    <div className="px-2 pb-1 pt-3">
                      <span className="block text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-border/40 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                        {t(`dashboard.editor.sections.card_size_${item.span}`)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm font-semibold text-muted-foreground">
                {t('dashboard.editor.sections.card_catalog_empty')}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const editorModal = editingCard ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99999] grid place-items-center bg-black/55 px-4 backdrop-blur-sm"
        onClick={() => setEditingCardId(null)}
      >
        <div
          className="w-full max-w-xl rounded-[2rem] border border-border/60 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Editar
              </p>
              <h3 className="text-xl font-black text-foreground">
                Editar tarjeta
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setEditingCardId(null)}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {renderCatalogPreview(
              cardDraft.kind,
              cardDraft.title || (isClockKind(cardDraft.kind) ? getClockKindLabel(cardDraft.kind) : t(getCatalogLabelKey(cardDraft.kind))),
              cardDraft.span,
              cardDraft.icon
            )}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Nombre
              </span>
              <input
                value={cardDraft.title}
                onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              />
            </label>

            {isClockKind(cardDraft.kind) ? (
              <DashboardSelect
                label="Diseño de reloj"
                value={cardDraft.kind}
                options={clockCardOptions.map((option) => ({
                  value: option.kind,
                  label: option.label,
                }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || getClockKindLabel(nextKind),
                  }));
                }}
              />
            ) : (
              <DashboardSelect
                label="Tipo de tarjeta"
                value={cardDraft.kind}
                options={cardKinds
                  .filter((kind) => !isClockKind(kind))
                  .map((kind) => ({
                    value: kind,
                    label: t(getCatalogLabelKey(kind)),
                  }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: isBindableKind(nextKind) ? draft.entityId : '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || t(getCatalogLabelKey(nextKind)),
                  }));
                }}
              />
            )}

            <DashboardSelect
              label={t('dashboard.editor.sections.card_size')}
              value={cardDraft.span}
              options={[
                { value: 'small', label: t('dashboard.editor.sections.card_size_small') },
                { value: 'medium', label: t('dashboard.editor.sections.card_size_medium') },
                { value: 'full', label: t('dashboard.editor.sections.card_size_full') },
              ]}
              onChange={(value) => setCardDraft((draft) => ({ ...draft, span: value as SectionCardSpan }))}
            />

            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <IconPicker
                value={cardDraft.icon}
                onChange={(icon) => setCardDraft((draft) => ({ ...draft, icon }))}
              />
            ) : null}

            {isBindableKind(cardDraft.kind) ? (
              <div className="space-y-2">
                <DashboardSelect
                  label="Dispositivo asignado"
                  value={cardDraft.entityId}
                  placeholder="Sin asignar"
                  options={[
                    { value: '', label: 'Sin asignar' },
                    ...filteredDevices.map((device) => ({
                      value: device.id,
                      label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
                    })),
                  ]}
                  onChange={(selectedId) => {
                    const selectedDevice = devices.find((device) => device.id === selectedId);
                    setCardDraft((draft) => ({
                      ...draft,
                      entityId: selectedId,
                      title: selectedDevice?.name || draft.title,
                    }));
                  }}
                />

                <p className="text-xs font-semibold text-muted-foreground">
                  Esta asignación queda guardada dentro de la tarjeta de la sección.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-border/50 px-5 py-4">
            <button
              type="button"
              onClick={() => setEditingCardId(null)}
              className="rounded-2xl border border-border/50 px-5 py-2.5 text-sm font-black text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={saveCardEditor}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const sectionGrid = (
    <div
      onClick={(event) => event.stopPropagation()}
      className="grid min-h-0 flex-1 grid-cols-6 auto-rows-[10.5rem] content-start gap-3 overflow-visible pr-1"
    >
      {cards.map(renderCard)}

      {isEditing ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "inline-flex min-h-[10.5rem] items-center justify-center rounded-[1.35rem] border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 hover:bg-primary/10",
            cards.length === 0 ? "col-span-6" : "col-span-3"
          )}
          aria-label={t('dashboard.editor.sections.add_card')}
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  );

  if (!isEditing) {
    return (
      <section
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full min-w-0 flex-col gap-3 overflow-visible px-1 pb-2 pt-1"
      >
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1.25rem,2.4cqi,1.65rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}

        {sectionGrid}

        {catalogModal}
        {editorModal}
      </section>
    );
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="group/section relative flex h-full w-full min-w-0 flex-col overflow-visible rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5"
    >
      <div className="mb-4 flex min-w-0 items-center gap-2 pr-10">
        {showTitle ? (
          isEditingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveTitle();
                if (event.key === 'Escape') {
                  setDraftTitle(config.appearance?.title || '');
                  setIsEditingTitle(false);
                }
              }}
              className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-background/70 px-3 py-1.5 text-base font-black text-foreground outline-none"
              aria-label={t('dashboard.editor.sections.edit_section_title')}
            />
          ) : (
            <>
              <h2 className="min-w-0 truncate text-[clamp(1.1rem,2cqi,1.45rem)] font-black tracking-tight text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftTitle(config.appearance?.title || title);
                  setIsEditingTitle(true);
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border/40 bg-background/60 text-muted-foreground opacity-0 transition-all hover:border-primary/50 hover:text-primary group-hover/section:opacity-100"
                aria-label={t('dashboard.editor.sections.edit_section_title')}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
            {t('dashboard.editor.sections.untitled_section')}
          </span>
        )}
      </div>

      {sectionGrid}

      {catalogModal}
      {editorModal}
    </div>
  );
}
