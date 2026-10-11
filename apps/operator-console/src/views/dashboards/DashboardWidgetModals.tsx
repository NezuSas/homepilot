import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Heading } from '../../components/ui/Heading';
import { Input } from '../../components/ui/Input';
import { SearchableSelectField } from '../../components/ui/SearchableSelectField';
import { Modal } from '../../components/ui/Modal';
import { getAvailableSectionWidths } from './dashboardUtils';
import { IconPicker, getDashboardIconComponent } from './components/IconPicker';
import { getClockGridOptions } from './widgets/clock/clockRegistry';
import { getCardGridHeight, getCardGridWidth } from './widgets/cardGridResize';
import { CardGridSizePicker } from './widgets/CardGridSizePicker';
import { CardPreviewFrame } from './widgets/CardPreviewFrame';
import { ClockWidget } from './widgets/ClockWidget';
import type { CardGridOptions, DashboardWidgetConfig } from './types';

interface ClockSizeModalProps {
  isOpen: boolean;
  config: DashboardWidgetConfig;
  draft: CardGridOptions;
  sectionWidth: number;
  onDraftChange: (draft: CardGridOptions) => void;
  onSave: (size: CardGridOptions) => void;
  onClose: () => void;
}

/** Resize dialog of a standalone clock widget, with a live preview at the chosen footprint. */
export function ClockSizeModal({ isOpen, config, draft, sectionWidth, onDraftChange, onSave, onClose }: ClockSizeModalProps) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.edit')}
      className="max-w-5xl" headerAlign="start" footerClassName="justify-end gap-2 p-5 sm:p-6"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={() => onSave(getClockGridOptions(draft))}>{t('common.save')}</Button>
      </>}>
      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <CardGridSizePicker value={draft} allowAutomatic={false} onChange={next => onDraftChange(getClockGridOptions(next))} />
        <div className="homepilot-dashboard-screen min-w-0">
          <Heading as="h3" variant="item" className="mb-3">{t('dashboards.edit_session.preview')}</Heading>
          <CardPreviewFrame fitCard sectionWidth={sectionWidth} label={t('dashboards.edit_session.preview')}>
            <div className="rounded-section sm:rounded-panel" style={{ containerType: 'size', containerName: 'clock-card', width: getCardGridWidth(sectionWidth, draft.columns), height: getCardGridHeight(draft.rows) }}>
              <ClockWidget config={config} />
            </div>
          </CardPreviewFrame>
        </div>
      </div>
    </Modal>
  );
}

interface SectionEditorModalProps {
  isOpen: boolean;
  columns: number;
  draftTitle: string;
  draftIcon: string;
  draftSpan: number;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string) => void;
  onSpanChange: (span: number) => void;
  onSave: () => void;
  onClose: () => void;
}

/** Title, icon and width editor of a section. */
export function SectionEditorModal({ isOpen, columns, draftTitle, draftIcon, draftSpan, onTitleChange, onIconChange, onSpanChange, onSave, onClose }: SectionEditorModalProps) {
  const { t } = useTranslation();
  const SectionDraftIcon = draftIcon ? getDashboardIconComponent(draftIcon) : null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.editor.sections.edit_section_title')}
      headerAlign="start"
      className="max-w-md"
      footer={(
        <div className="flex w-full justify-end gap-3 p-5 sm:p-6">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {t('dashboard.editor.sections.cancel')}
          </Button>
          <Button type="button" variant="primary" size="md" onClick={onSave}>
            {t('dashboard.editor.sections.save')}
          </Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <SearchableSelectField label={t('dashboards.edit_session.section_width')} value={String(Math.min(draftSpan, columns))} options={getAvailableSectionWidths(columns).map(value => ({ value: String(value), label: String(value) }))} onChange={value => onSpanChange(Number(value))} />
        <Input
          autoFocus
          label={t('dashboard.editor.sections.section_title')}
          value={draftTitle}
          placeholder={t('dashboard.editor.sections.section_title_placeholder')}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}
        />
        <div className="space-y-2">
          <IconPicker value={draftIcon} onChange={onIconChange} />
          {draftIcon && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onIconChange('')}>
              {t('dashboard.editor.sections.remove_section_icon')}
            </Button>
          )}
        </div>
        <div role="group" aria-label={t('dashboard.editor.sections.section_preview')} className="rounded-xl border border-border/50 bg-background/40 p-3">
          <div className="flex items-center gap-2 text-dashboard-section-title-fluid font-black tracking-tight text-foreground">
            {SectionDraftIcon && <SectionDraftIcon className="h-5 w-5 shrink-0 text-primary" />}
            <span className="min-w-0 truncate">{draftTitle.trim() || t('dashboard.editor.sections.new_section')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
