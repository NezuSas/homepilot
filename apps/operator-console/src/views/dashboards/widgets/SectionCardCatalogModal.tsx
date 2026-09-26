import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import type { WidgetType } from '../types';
import { ModalPortal } from './ModalPortal';
import {
  catalogCategories, type NormalizedSectionCardKind, type SectionCardCategory,
  type SectionCardIcon, type SectionCardSpan,
} from './sectionCardCatalog';

const DESKTOP_SECTION_COLUMNS = 4;

export interface SectionCatalogItem {
  kind: NormalizedSectionCardKind;
  title: string;
  description: string;
  widgetType: WidgetType;
  span: SectionCardSpan;
  icon: SectionCardIcon;
}

interface SectionCardCatalogModalProps {
  query: string;
  onQueryChange: (query: string) => void;
  categoryFilter: SectionCardCategory | null;
  onFilterChange: (category: SectionCardCategory | null) => void;
  items: SectionCatalogItem[];
  onSelect: (item: SectionCatalogItem) => void;
  onClose: () => void;
  renderCatalogPreview: (kind: NormalizedSectionCardKind, title?: string, span?: SectionCardSpan, icon?: SectionCardIcon) => ReactNode;
}

export function SectionCardCatalogModal({
  query, onQueryChange, categoryFilter: catalogCategoryFilter, onFilterChange,
  items, onSelect, onClose, renderCatalogPreview,
}: SectionCardCatalogModalProps) {
  const { t } = useTranslation();
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99990] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
        onClick={() => onClose()}
      >
        <div
          className="max-h-section-modal w-full max-w-5xl overflow-hidden rounded-panel border border-border/50 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
            <div>
              <p className="text-micro font-black uppercase tracking-label-ultra text-primary">
                {t('dashboard.editor.sections.add_card')}
              </p>
              <h3 className="mt-1 text-view-title font-black tracking-tight text-foreground">
                {t('dashboard.editor.sections.card_catalog_title')}
              </h3>
            </div>
            <IconButton
              icon={X}
              label={t('common.close')}
              onClick={() => onClose()}
              variant="ghost"
              size="md"
            />
          </div>

          <div className="space-y-3 border-b border-border/40 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('dashboard.editor.sections.card_catalog_search')}
              icon={<Search className="h-4 w-4" />}
              className="h-11 border-border/50 bg-background/50 font-semibold placeholder:text-muted-foreground/55"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={catalogCategoryFilter === null ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange(null)}
                className="h-8 rounded-full px-3 text-micro font-black uppercase tracking-control"
              >
                {t('dashboard.editor.sections.category_all')}
              </Button>
              {catalogCategories.map((category) => (
                <Button
                  key={category.key}
                  type="button"
                  variant={catalogCategoryFilter === category.key ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onFilterChange(category.key)}
                  className="h-8 rounded-full px-3 text-micro font-black uppercase tracking-control"
                >
                  {t(category.labelKey)}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-h-section-editor overflow-y-auto p-6">
            {items.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item.kind}
                    className="group relative w-full rounded-card border border-border/50 bg-background/30 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-within:border-primary/50"
                  >
                    <div aria-hidden="true" className="pointer-events-none">
                      {renderCatalogPreview(item.kind, item.title, item.span, item.icon)}
                    </div>
                    <div className="px-2 pb-1 pt-3">
                      <span className="block text-body font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-caption font-medium leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-border/40 px-2 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">
                        {item.span === 'full'
                          ? t('dashboard.editor.sections.card_size_full')
                          : t(`dashboard.editor.sections.card_size_${item.span}`, {
                            count: item.span === 'small' ? DESKTOP_SECTION_COLUMNS : Math.max(1, Math.floor(DESKTOP_SECTION_COLUMNS / 2)),
                          })}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={item.title}
                      onClick={() => onSelect(item)}
                      className="absolute inset-0 h-full w-full rounded-card opacity-0 focus-visible:opacity-100 focus-visible:bg-primary/10"
                    >
                      <span className="sr-only">{item.title}</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-body font-semibold text-muted-foreground">
                {t('dashboard.editor.sections.card_catalog_empty')}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
