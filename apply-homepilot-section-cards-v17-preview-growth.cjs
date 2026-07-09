// HomePilot Section Cards V17 - previews, no internal scroll, portal modals
// Run from repo root:
// node .\apply-homepilot-section-cards-v17-preview-growth.cjs
//
// Fixes:
// - "Reloj" is rendered as a visual clock preview, not a generic type icon.
// - All card options/cards get a visual preview of what the user will see.
// - Section content does NOT scroll internally; section height grows with cards.
// - Internal cards remain max 2 columns and grow vertically.
// - Edit/catalog modals render through a React portal above the canvas/placeholder.

const fs = require("fs");

const path = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";

const content = `import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Camera,
  Clock,
  Home,
  Layers,
  Lightbulb,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig, WidgetType } from '../types';

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
  | 'energy'
  | 'assistant'
  | 'system';

interface SectionCardItem {
  id: string;
  kind: SectionCardKind;
  title: string;
  description?: string;
  widgetType?: WidgetType;
  entityId?: string;
  entityName?: string;
}

interface CardDraft {
  title: string;
  kind: SectionCardKind;
  entityId: string;
}

const createId = () => \`section-card-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;

const cardKinds: SectionCardKind[] = [
  'device',
  'light',
  'cover',
  'camera',
  'room',
  'scene',
  'clock',
  'energy',
  'assistant',
  'system',
];

function getIcon(kind: SectionCardKind) {
  switch (kind) {
    case 'light':
      return Lightbulb;
    case 'cover':
      return Layers;
    case 'camera':
      return Camera;
    case 'room':
      return Home;
    case 'scene':
      return Monitor;
    case 'clock':
      return Clock;
    case 'energy':
      return Zap;
    case 'assistant':
      return Bot;
    case 'system':
      return Monitor;
    case 'device':
    default:
      return Lightbulb;
  }
}

function getWidgetType(kind: SectionCardKind): WidgetType {
  switch (kind) {
    case 'room':
      return 'room_overview' as WidgetType;
    case 'scene':
      return 'scene_shortcut' as WidgetType;
    case 'clock':
      return 'clock_display' as WidgetType;
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

function normalizeCards(extra: DashboardWidgetConfig['extra']): SectionCardItem[] {
  const rawCards = extra?.cards;
  if (!Array.isArray(rawCards)) return [];

  return rawCards
    .filter((card): card is SectionCardItem => {
      if (!card || typeof card !== 'object') return false;
      const candidate = card as Partial<SectionCardItem>;
      return typeof candidate.id === 'string' && typeof candidate.kind === 'string';
    })
    .map((card) => ({
      ...card,
      title: typeof card.title === 'string' && card.title.trim() ? card.title : card.kind,
      widgetType: card.widgetType ?? getWidgetType(card.kind),
    }));
}

function getRecommendedSectionHeight(currentHeight: number, cardsCount: number) {
  const internalItems = Math.max(1, cardsCount + 1);
  const internalRows = Math.ceil(internalItems / 2);

  // 1 title row + 1 dashboard row per internal grid row.
  const recommended = Math.max(2, internalRows + 1);
  return Math.max(currentHeight || 2, recommended);
}

function isBindableKind(kind: SectionCardKind) {
  return kind === 'device' || kind === 'light' || kind === 'cover' || kind === 'camera';
}

function CardVisualPreview({ kind, compact = false }: { kind: SectionCardKind; compact?: boolean }) {
  const Icon = getIcon(kind);

  if (kind === 'clock') {
    return (
      <div className={cn("relative grid place-items-center rounded-2xl border border-primary/25 bg-primary/10", compact ? "h-16 w-20" : "h-20 w-28")}>
        <div className="absolute right-2 top-2 h-5 w-5 rounded-full border border-primary/50">
          <span className="absolute left-1/2 top-1/2 h-[1px] w-1.5 origin-left rotate-[-45deg] bg-primary" />
          <span className="absolute left-1/2 top-1/2 h-[1px] w-2 origin-left rotate-90 bg-primary" />
        </div>
        <div className="text-center">
          <div className={cn("font-black tracking-tight text-primary", compact ? "text-lg" : "text-2xl")}>10:24</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">Lun</div>
        </div>
      </div>
    );
  }

  if (kind === 'camera') {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/10", compact ? "h-16 w-20" : "h-20 w-28")}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5" />
        <div className="absolute left-3 top-3 h-2 w-2 rounded-full bg-primary" />
        <Camera className="absolute bottom-3 right-3 h-7 w-7 text-primary/80" />
      </div>
    );
  }

  if (kind === 'energy') {
    return (
      <div className={cn("rounded-2xl border border-primary/25 bg-primary/10 p-3", compact ? "h-16 w-20" : "h-20 w-28")}>
        <Zap className="mb-1 h-5 w-5 text-primary" />
        <div className="text-lg font-black text-primary">1.8kW</div>
        <div className="mt-1 h-1.5 rounded-full bg-primary/20">
          <div className="h-full w-2/3 rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (kind === 'room') {
    return (
      <div className={cn("grid rounded-2xl border border-primary/25 bg-primary/10 p-2", compact ? "h-16 w-20 grid-cols-2 gap-1" : "h-20 w-28 grid-cols-2 gap-1.5")}>
        <span className="rounded-lg bg-primary/25" />
        <span className="rounded-lg bg-primary/15" />
        <span className="rounded-lg bg-primary/15" />
        <span className="rounded-lg bg-primary/25" />
      </div>
    );
  }

  if (kind === 'scene') {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-primary/25 bg-primary/10", compact ? "h-16 w-20" : "h-20 w-28")}>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground">
          <Monitor className="h-5 w-5" />
        </div>
      </div>
    );
  }

  if (kind === 'assistant') {
    return (
      <div className={cn("rounded-2xl border border-primary/25 bg-primary/10 p-3", compact ? "h-16 w-20" : "h-20 w-28")}>
        <Bot className="mb-2 h-5 w-5 text-primary" />
        <div className="h-1.5 w-10 rounded-full bg-primary/50" />
        <div className="mt-1.5 h-1.5 w-14 rounded-full bg-primary/25" />
      </div>
    );
  }

  if (kind === 'system') {
    return (
      <div className={cn("rounded-2xl border border-primary/25 bg-primary/10 p-3", compact ? "h-16 w-20" : "h-20 w-28")}>
        <Monitor className="mb-2 h-5 w-5 text-primary" />
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-2 w-2 rounded-full bg-primary/50" />
          <span className="h-2 w-2 rounded-full bg-primary/30" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid place-items-center rounded-2xl border border-primary/25 bg-primary/10", compact ? "h-16 w-20" : "h-20 w-28")}>
      <Icon className={cn("text-primary", compact ? "h-8 w-8" : "h-10 w-10")} />
    </div>
  );
}

function ModalPortal({ children }: { children: React.ReactNode }) {
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
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '' });

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  const catalogItems = useMemo(() => [
    {
      kind: 'device' as const,
      title: t('dashboard.editor.sections.section_card_device'),
      description: t('dashboard.editor.sections.section_card_device_desc'),
      widgetType: 'device_control' as WidgetType,
    },
    {
      kind: 'light' as const,
      title: t('dashboard.editor.sections.section_card_light'),
      description: t('dashboard.editor.sections.section_card_light_desc'),
      widgetType: 'device_control' as WidgetType,
    },
    {
      kind: 'cover' as const,
      title: t('dashboard.editor.sections.section_card_cover'),
      description: t('dashboard.editor.sections.section_card_cover_desc'),
      widgetType: 'device_control' as WidgetType,
    },
    {
      kind: 'camera' as const,
      title: t('dashboard.editor.sections.section_card_camera'),
      description: t('dashboard.editor.sections.section_card_camera_desc'),
      widgetType: 'device_control' as WidgetType,
    },
    {
      kind: 'room' as const,
      title: t('dashboard.editor.sections.section_card_room'),
      description: t('dashboard.editor.sections.section_card_room_desc'),
      widgetType: 'room_overview' as WidgetType,
    },
    {
      kind: 'scene' as const,
      title: t('dashboard.editor.sections.section_card_scene'),
      description: t('dashboard.editor.sections.section_card_scene_desc'),
      widgetType: 'scene_shortcut' as WidgetType,
    },
    {
      kind: 'clock' as const,
      title: t('dashboard.editor.sections.section_card_clock'),
      description: t('dashboard.editor.sections.section_card_clock_desc'),
      widgetType: 'clock_display' as WidgetType,
    },
    {
      kind: 'energy' as const,
      title: t('dashboard.editor.sections.section_card_energy'),
      description: t('dashboard.editor.sections.section_card_energy_desc'),
      widgetType: 'energy_snapshot' as WidgetType,
    },
    {
      kind: 'assistant' as const,
      title: t('dashboard.editor.sections.section_card_assistant'),
      description: t('dashboard.editor.sections.section_card_assistant_desc'),
      widgetType: 'assistant_insight' as WidgetType,
    },
    {
      kind: 'system' as const,
      title: t('dashboard.editor.sections.section_card_system'),
      description: t('dashboard.editor.sections.section_card_system_desc'),
      widgetType: 'system_status' as WidgetType,
    },
  ], [t]);

  const filteredCatalog = catalogItems.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return \`\${item.title} \${item.description}\`.toLowerCase().includes(normalizedQuery);
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

  const updateCards = (nextCards: SectionCardItem[]) => {
    onUpdate?.({
      layout: {
        ...config.layout,
        h: getRecommendedSectionHeight(config.layout.h, nextCards.length),
      },
      extra: {
        ...config.extra,
        cards: nextCards,
      },
    });
  };

  const addCard = (item: typeof catalogItems[number]) => {
    const nextCard: SectionCardItem = {
      id: createId(),
      kind: item.kind,
      title: item.title,
      description: item.description,
      widgetType: item.widgetType,
    };

    updateCards([...cards, nextCard]);
    setIsCatalogOpen(false);
    setQuery('');

    setEditingCardId(nextCard.id);
    setCardDraft({
      title: nextCard.title,
      kind: nextCard.kind,
      entityId: '',
    });
  };

  const openCardEditor = (card: SectionCardItem) => {
    setEditingCardId(card.id);
    setCardDraft({
      title: card.title,
      kind: card.kind,
      entityId: card.entityId || '',
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
        title: cardDraft.title.trim() || selectedDevice?.name || card.title,
        widgetType: getWidgetType(cardDraft.kind),
        entityId: cardDraft.entityId || undefined,
        entityName: selectedDevice?.name,
      };
    });

    updateCards(nextCards);
    setEditingCardId(null);
  };

  const removeCard = (id: string) => {
    updateCards(cards.filter((card) => card.id !== id));
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

  const renderCard = (card: SectionCardItem) => {
    const subtitle = card.entityName || card.description;

    return (
      <div
        key={card.id}
        className="group/card relative flex min-h-28 flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/65 px-3 py-4 text-center shadow-sm transition-all hover:border-primary/45 hover:bg-card/85"
      >
        <CardVisualPreview kind={card.kind} compact />
        <span className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{card.title}</span>
        {subtitle ? (
          <span className="mt-1 line-clamp-1 text-[10px] font-semibold text-muted-foreground">
            {subtitle}
          </span>
        ) : null}

        {isEditing ? (
          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openCardEditor(card);
              }}
              className="grid h-7 w-7 place-items-center rounded-lg bg-background/80 text-muted-foreground transition hover:text-primary"
              aria-label="Edit card"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeCard(card.id);
              }}
              className="grid h-7 w-7 place-items-center rounded-lg bg-background/80 text-muted-foreground transition hover:text-destructive"
              aria-label="Remove card"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
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
          className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl"
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

          <div className="max-h-[56vh] overflow-y-auto p-6">
            {filteredCatalog.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => addCard(item)}
                    className="flex min-h-32 items-center gap-4 rounded-2xl border border-border/50 bg-background/35 p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    <CardVisualPreview kind={item.kind} />
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
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
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
        onClick={() => setEditingCardId(null)}
      >
        <div
          className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">Editar</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground">Editar tarjeta</h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingCardId(null)}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-3xl border border-border/50 bg-background/35 p-4">
              <CardVisualPreview kind={cardDraft.kind} />
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Nombre</span>
              <input
                value={cardDraft.title}
                onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Tipo de tarjeta</span>
              <select
                value={cardDraft.kind}
                onChange={(event) => {
                  const nextKind = event.target.value as SectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: isBindableKind(nextKind) ? draft.entityId : '',
                  }));
                }}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              >
                {cardKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {catalogItems.find((item) => item.kind === kind)?.title || kind}
                  </option>
                ))}
              </select>
            </label>

            {isBindableKind(cardDraft.kind) ? (
              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Dispositivo asignado</span>
                <select
                  value={cardDraft.entityId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    const selectedDevice = devices.find((device) => device.id === selectedId);
                    setCardDraft((draft) => ({
                      ...draft,
                      entityId: selectedId,
                      title: draft.title || selectedDevice?.name || '',
                    }));
                  }}
                  className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
                >
                  <option value="">Sin asignar</option>
                  {filteredDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} · {device.type || device.semanticType || 'device'}
                    </option>
                  ))}
                </select>
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                  Esta asignación queda guardada dentro de la tarjeta de la sección.
                </p>
              </label>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-border/40 px-6 py-4">
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
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground transition hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  if (!isEditing) {
    return (
      <section className="flex h-full w-full min-w-0 flex-col gap-3 overflow-visible px-1 pb-2 pt-1">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.3rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}

        {cards.length > 0 ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-visible pr-1">
            {cards.map(renderCard)}
          </div>
        ) : null}

        {catalogModal}
        {editorModal}
      </section>
    );
  }

  return (
    <div className="group/section relative flex h-full w-full min-w-0 flex-col overflow-visible rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
      <div className="mb-3 flex min-w-0 items-center gap-2 pr-10">
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
              className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-background/70 px-3 py-1.5 text-sm font-semibold text-foreground outline-none"
              aria-label={t('dashboard.editor.sections.edit_section_title')}
            />
          ) : (
            <>
              <h2 className="min-w-0 truncate text-[clamp(0.85rem,1.65cqi,1rem)] font-semibold text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftTitle(config.appearance?.title || title);
                  setIsEditingTitle(true);
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/40 bg-background/60 text-muted-foreground opacity-0 transition-all hover:border-primary/50 hover:text-primary group-hover/section:opacity-100"
                aria-label={t('dashboard.editor.sections.edit_section_title')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )
        ) : (
          <span className="text-[clamp(0.72rem,1.35cqi,0.85rem)] font-semibold text-muted-foreground">
            {t('dashboard.editor.sections.untitled_section')}
          </span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-visible pr-1">
        {cards.map(renderCard)}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "inline-flex min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 hover:bg-primary/10",
            cards.length === 0 && "col-span-2"
          )}
          aria-label={t('dashboard.editor.sections.add_card')}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {catalogModal}
      {editorModal}
    </div>
  );
}
`;

fs.writeFileSync(path, content, "utf8");

console.log("SectionWidget V17 preview/growth/modal layering applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
