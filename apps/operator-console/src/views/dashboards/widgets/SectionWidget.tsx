import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
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
import { DeviceWidget } from './DeviceWidget';
import { RoomWidget } from './RoomWidget';
import { SceneShortcutWidget } from './SceneShortcutWidget';
import { AssistantInsightWidget } from './AssistantInsightWidget';
import { SystemStatusWidget } from './SystemStatusWidget';
import { EnergySnapshotWidget } from './EnergySnapshotWidget';
import { ClockWidget } from './ClockWidget';

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

const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

function getCatalogLabelKey(kind: SectionCardKind) {
  switch (kind) {
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
    case 'clock':
      return 'dashboard.editor.sections.section_card_clock';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant';
    case 'system':
      return 'dashboard.editor.sections.section_card_system';
  }
}

function getCatalogDescriptionKey(kind: SectionCardKind) {
  switch (kind) {
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
    case 'clock':
      return 'dashboard.editor.sections.section_card_clock_desc';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy_desc';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant_desc';
    case 'system':
      return 'dashboard.editor.sections.section_card_system_desc';
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
  // The add-card tile is always an extra tile after the cards.
  // 2 internal items per row. Real designed cards need enough height
  // so the outer section border grows instead of clipping row 2.
  const internalItems = Math.max(1, cardsCount + 1);
  const internalRows = Math.ceil(internalItems / 2);
  const recommended = Math.max(4, 1 + internalRows * 3);
  return Math.max(currentHeight || 4, recommended);
}

function isBindableKind(kind: SectionCardKind) {
  return kind === 'device' || kind === 'light' || kind === 'cover' || kind === 'camera';
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

  const catalogItems = useMemo(() => cardKinds.map((kind) => ({
    kind,
    title: t(getCatalogLabelKey(kind)),
    description: t(getCatalogDescriptionKey(kind)),
    widgetType: getWidgetType(kind),
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
        title: cardDraft.title.trim() || selectedDevice?.name || t(getCatalogLabelKey(cardDraft.kind)),
        description: t(getCatalogDescriptionKey(cardDraft.kind)),
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

  const buildInternalConfig = (card: SectionCardItem): DashboardWidgetConfig => ({
    ...config,
    layout: { x: 0, y: 0, w: 2, h: 2 },
    binding: {
      ...config.binding,
      entityId: card.entityId || config.binding?.entityId || '',
    },
    appearance: {
      ...config.appearance,
      title: card.title,
      showTitle: true,
      variant: config.appearance?.variant || 'glass',
    },
    extra: {
      // Safe defaults for real widget previews rendered inside sections.
      // Some widgets expect these fields to exist during render.
      percentage: 64,
      value: 64,
      current: 64,
      total: 100,
      unit: '%',
      status: 'preview',
      label: card.title,
      subtitle: card.entityName || card.description || '',
      cameraStatus: card.entityId ? 'live' : 'connecting',
      energy: {
        percentage: 64,
        current: 1.8,
        unit: 'kW',
        trend: 5,
      },
      metrics: {
        percentage: 64,
        current: 1.8,
        total: 3.0,
        unit: 'kW',
      },
      stats: {
        percentage: 64,
        active: 1,
        total: 7,
      },
      ...config.extra,
      sectionCardId: card.id,
      sectionCardKind: card.kind,
      sectionCardPreview: true,
    },
  });

  const renderRealDesignedCard = (card: SectionCardItem) => {
    const internalConfig = buildInternalConfig(card);

    switch (card.kind) {
      case 'room':
        return <RoomWidget config={internalConfig} isEditing={false} onConfigure={() => openCardEditor(card)} />;
      case 'scene':
        return <SceneShortcutWidget config={internalConfig} isEditing={false} onConfigure={() => openCardEditor(card)} />;
      case 'clock':
        return <ClockWidget config={internalConfig} />;
      case 'energy':
        return <EnergySnapshotWidget config={internalConfig} isEditing={false} onConfigure={() => openCardEditor(card)} />;
      case 'assistant':
        return <AssistantInsightWidget config={internalConfig} />;
      case 'system':
        return <SystemStatusWidget config={internalConfig} isEditing={false} onConfigure={() => openCardEditor(card)} />;
      case 'device':
      case 'light':
      case 'cover':
      case 'camera':
      default:
        return <DeviceWidget config={internalConfig} isEditing={false} onConfigure={() => openCardEditor(card)} />;
    }
  };

  const renderCard = (card: SectionCardItem) => (
    <div
      key={card.id}
      className="group/card relative min-h-[13rem] overflow-hidden rounded-[1.35rem] border border-border/45 bg-card/75 shadow-sm transition-all hover:border-primary/45"
    >
      <div className="h-full w-full">
        {renderRealDesignedCard(card)}
      </div>

      {isEditing ? (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
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

  const renderCatalogPreview = (kind: SectionCardKind) => {
    const previewCard: SectionCardItem = {
      id: `preview-${kind}`,
      kind,
      title: t(getCatalogLabelKey(kind)),
      description: t(getCatalogDescriptionKey(kind)),
      widgetType: getWidgetType(kind),
    };

    return (
      <div className="h-44 overflow-hidden rounded-[1.5rem] border border-border/45 bg-background/40">
        {renderRealDesignedCard(previewCard)}
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
                    {renderCatalogPreview(item.kind)}
                    <div className="px-2 pb-1 pt-3">
                      <span className="block text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                        {item.description}
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
            <div className="h-52 overflow-hidden rounded-[1.75rem] border border-border/50 bg-background/35 p-2">
              {renderCatalogPreview(cardDraft.kind)}
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
                    title: draft.title || t(getCatalogLabelKey(nextKind)),
                  }));
                }}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              >
                {cardKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(getCatalogLabelKey(kind))}
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
                      title: selectedDevice?.name || draft.title,
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

  const sectionGrid = (
    <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-[13rem] content-start gap-3 overflow-visible pr-1">
      {cards.map(renderCard)}

      {isEditing ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "inline-flex min-h-[13rem] items-center justify-center rounded-[1.35rem] border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 hover:bg-primary/10",
            cards.length === 0 && "col-span-2"
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
      <section className="flex h-full w-full min-w-0 flex-col gap-3 overflow-visible px-1 pb-2 pt-1">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.3rem)] font-black tracking-tight text-foreground">
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

      {sectionGrid}

      {catalogModal}
      {editorModal}
    </div>
  );
}
