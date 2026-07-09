import { useMemo, useState } from 'react';
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
}

const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    }));
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.appearance?.title || '');

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);

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
    return `${item.title} ${item.description}`.toLowerCase().includes(normalizedQuery);
  });

  const updateCards = (nextCards: SectionCardItem[]) => {
    onUpdate?.({
      extra: {
        ...config.extra,
        cards: nextCards,
      },
    });
  };

  const addCard = (item: typeof catalogItems[number]) => {
    updateCards([
      ...cards,
      {
        id: createId(),
        kind: item.kind,
        title: item.title,
        description: item.description,
        widgetType: item.widgetType,
      },
    ]);
    setIsCatalogOpen(false);
    setQuery('');
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

  if (!isEditing) {
    return (
      <section className="flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden px-1 pb-2 pt-1">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.3rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}

        {cards.length > 0 ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3">
            {cards.map((card) => {
              const Icon = getIcon(card.kind);
              return (
                <div key={card.id} className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/70 px-3 py-4 text-center">
                  <Icon className="mb-2 h-9 w-9 text-primary/80" />
                  <span className="line-clamp-2 text-sm font-semibold text-foreground">{card.title}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="group/section relative flex h-full w-full min-w-0 flex-col rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
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

      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-hidden">
        {cards.map((card) => {
          const Icon = getIcon(card.kind);
          return (
            <div
              key={card.id}
              className="group/card relative flex min-h-24 flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/65 px-3 py-4 text-center shadow-sm transition-all hover:border-primary/45 hover:bg-card/85"
            >
              <Icon className="mb-2 h-9 w-9 text-primary/80" />
              <span className="line-clamp-2 text-sm font-semibold text-foreground">{card.title}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  removeCard(card.id);
                }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-background/75 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/card:opacity-100"
                aria-label="Remove card"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "inline-flex min-h-24 items-center justify-center rounded-2xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 hover:bg-primary/10",
            cards.length === 0 && "col-span-2"
          )}
          aria-label={t('dashboard.editor.sections.add_card')}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {isCatalogOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/65 p-4 backdrop-blur-md"
          onClick={() => setIsCatalogOpen(false)}
        >
          <div
            className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl"
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

            <div className="max-h-[52vh] overflow-y-auto p-6">
              {filteredCatalog.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredCatalog.map((item) => {
                    const Icon = getIcon(item.kind);
                    return (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => addCard(item)}
                        className="flex min-h-28 items-center gap-4 rounded-2xl border border-border/50 bg-background/35 p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-foreground">{item.title}</span>
                          <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm font-semibold text-muted-foreground">
                  {t('dashboard.editor.sections.card_catalog_empty')}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
