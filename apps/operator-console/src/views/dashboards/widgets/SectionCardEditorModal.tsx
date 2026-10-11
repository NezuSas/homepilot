import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPicker } from '../components/IconPicker';
import { getClockGridOptions } from './clock/clockRegistry';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { Button } from '../../../components/ui/Button';
import { Heading } from '../../../components/ui/Heading';
import { Input } from '../../../components/ui/Input';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { CardGridOptions } from '../types';
import { normalizeSensorScale, type SensorVisualStyle, type SensorScale } from './sectionCardCatalog';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { Modal } from '../../../components/ui/Modal';
import { CardGridSizePicker } from './CardGridSizePicker';
import { CardPreviewFrame } from './CardPreviewFrame';
import {
  cardKinds, isBindableKind, isClockKind,
  normalizeKind, type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type CardDraft,
  type MediaVariant, type NormalizedSectionCardKind, type SectionCardIcon, type SectionCardKind, type SectionCardSpan,
} from './sectionCardCatalog';
import { applyCardTypeChange, applyInfoSourceChange, isSensorScaleInvalid, resolveEditorGridOptions } from './sectionCardEditorModel';
import { SectionCardAssignmentField } from './SectionCardAssignmentField';
import { SectionCardSensorFields } from './SectionCardSensorFields';

interface SectionCardEditorModalProps {
  isBadgeRow?: boolean;
  sectionWidth?: number;
  cardDraft: CardDraft;
  setCardDraft: Dispatch<SetStateAction<CardDraft>>;
  catalogLabel: (kind: SectionCardKind) => string;
  assignableDevices: SnapshotDevice[];
  assignableRooms: SnapshotRoom[];
  scenes: AssignableScene[];
  automations: AssignableAutomation[];
  displayActions: AssignableDisplayAction[];
  devices: SnapshotDevice[];
  renderCatalogPreview: (
    kind: NormalizedSectionCardKind,
    titleOverride?: string,
    spanOverride?: SectionCardSpan,
    iconOverride?: SectionCardIcon,
    deviceIdOverride?: string,
    isEditorPreview?: boolean,
    mediaVariantOverride?: MediaVariant,
    sensorScaleOverride?: SensorScale,
    sensorDecimalsOverride?: boolean,
    visualStyleOverride?: SensorVisualStyle,
    gridOptionsOverride?: CardGridOptions,
  ) => ReactNode;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export function SectionCardEditorModal({
  cardDraft, setCardDraft, catalogLabel, assignableDevices, assignableRooms,
  scenes, automations, displayActions, devices, renderCatalogPreview, onClose, onSave, onDelete, sectionWidth, isBadgeRow = false,
}: SectionCardEditorModalProps) {
  const { t } = useTranslation();
  const [validMinimum, setValidMinimum] = useState(true);
  const [validMaximum, setValidMaximum] = useState(true);
  const [panel, setPanel] = useState<'configuration' | 'design' | 'visibility'>('configuration');
  const clock = isClockKind(cardDraft.kind);
  const gridOptions = resolveEditorGridOptions(cardDraft, clock, getClockGridOptions);
  const sensorScale = normalizeSensorScale({ min: cardDraft.sensorMin, max: cardDraft.sensorMax });
  const invalidScale = isSensorScaleInvalid(cardDraft, sensorScale, validMinimum, validMaximum);
  return (
    <Modal isOpen onClose={onClose} title={t('common.edit')} headerAlign="start" layerClassName="!items-start" className="section-card-editor !my-0 max-w-5xl"
      bodyClassName="flex flex-1 flex-col overflow-hidden" headerClassName="shrink-0" contentClassName="min-h-0 flex-1"
      footerClassName="justify-end gap-2 px-5 py-4 sm:px-8"
      footer={<>
        <Button type="button" variant="ghost" className="mr-auto text-danger" onClick={onDelete}>{t('common.delete')}</Button>
        <Button type="button" onClick={onClose} variant="secondary">{t('dashboard.editor.sections.cancel')}</Button>
        <Button type="button" onClick={onSave} disabled={invalidScale}>{t('dashboard.editor.sections.save')}</Button>
      </>}>
          <div className="section-card-editor-layout">
            <div className="section-card-editor-preview" data-card-editor-preview>
            <Heading as="h3" variant="item" className="mb-3">{t('dashboards.edit_session.preview')}</Heading>
            <CardPreviewFrame fitCard fitContent={isBadgeRow} label={t('dashboards.edit_session.preview')} sectionWidth={sectionWidth}>
            {renderCatalogPreview(
              cardDraft.kind,
              cardDraft.title || catalogLabel(cardDraft.kind),
              cardDraft.span,
              cardDraft.icon,
              cardDraft.entityId,
              true,
              cardDraft.mediaVariant,
              sensorScale,
              cardDraft.sensorDecimals,
              cardDraft.visualStyle,
              gridOptions,
            )}
            </CardPreviewFrame>
            </div>
            <div className="section-card-editor-controls space-y-4" data-card-editor-controls>
            <SegmentedControl layout="scroll" value={panel} onChange={setPanel} label={t('dashboards.edit_session.label')} options={(isBadgeRow ? ['configuration', 'visibility'] as const : ['configuration', 'design', 'visibility'] as const).map(value => ({ value, label: t(`dashboards.edit_session.${value}`) }))} />
            {panel === 'design' && <CardGridSizePicker value={gridOptions} allowAutomatic={!clock} onChange={next => setCardDraft(draft => ({ ...draft, gridOptions: clock ? getClockGridOptions(next) : next }))} />}
            {panel === 'visibility' && <ToggleSwitch label={t('dashboards.edit_session.visible')} checked={!cardDraft.hidden} onCheckedChange={visible => setCardDraft(draft => ({ ...draft, hidden: !visible }))} />}
            <div hidden={panel !== 'configuration'} className="space-y-4">
            {cardDraft.kind.startsWith('info_') && <SearchableSelectField
              label={t('dashboard.editor.sections.information_source')} value={cardDraft.kind}
              options={(['info_time', 'info_weather', 'info_sensor'] as const).map(value => ({ value, label: t(`dashboard.editor.sections.${value}`) }))}
              onChange={value => {
                if (value !== 'info_time' && value !== 'info_weather' && value !== 'info_sensor') return;
                setCardDraft(draft => applyInfoSourceChange(draft, value));
              }} />}

            {normalizeKind(cardDraft.kind) === 'media' && (
              <fieldset className="space-y-2">
                <legend className="text-caption font-semibold text-foreground">{t('dashboard.editor.sections.media_design')}</legend>
                <div className="flex gap-2">
                  {(['premium', 'classic'] as const).map((variant) => (
                    <Button
                      key={variant}
                      type="button"
                      variant={cardDraft.mediaVariant === variant ? 'primary' : 'outline'}
                      size="sm"
                      aria-pressed={cardDraft.mediaVariant === variant}
                      onClick={() => setCardDraft((draft) => ({ ...draft, mediaVariant: variant }))}
                    >
                      {t(`dashboard.editor.sections.media_design_${variant}`)}
                    </Button>
                  ))}
                </div>
              </fieldset>
            )}

            {cardDraft.kind === 'sensor' && <SectionCardSensorFields
              cardDraft={cardDraft}
              setCardDraft={setCardDraft}
              invalidScale={invalidScale}
              onMinimumValidityChange={setValidMinimum}
              onMaximumValidityChange={setValidMaximum}
            />}

            <Input
              label={t('dashboard.editor.sections.name')}
              value={cardDraft.title}
              onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
            />

            {!isClockKind(cardDraft.kind) && !cardDraft.kind.startsWith('info_') && (
              <SearchableSelectField
                label={t('dashboard.editor.sections.card_type')}
                value={cardDraft.kind === 'action' ? 'light' : cardDraft.kind}
                options={cardKinds.filter(kind => !kind.startsWith('info_'))
                  .filter((kind) => !isClockKind(kind))
                  .map((kind) => ({
                    value: kind,
                    label: catalogLabel(kind),
                  }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => applyCardTypeChange(draft, nextKind, catalogLabel));
                }}
              />
            )}

            {(cardDraft.kind.startsWith('info_') || cardDraft.kind === 'light' || cardDraft.kind === 'action' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <IconPicker
                value={cardDraft.icon}
                onChange={(icon) => setCardDraft((draft) => ({ ...draft, icon }))}
              />
            ) : null}

            {isBindableKind(cardDraft.kind) ? (
              <SectionCardAssignmentField
                cardDraft={cardDraft}
                setCardDraft={setCardDraft}
                assignableDevices={assignableDevices}
                assignableRooms={assignableRooms}
                scenes={scenes}
                automations={automations}
                displayActions={displayActions}
                devices={devices}
              />
            ) : null}
            </div>
            </div>
          </div>

    </Modal>
  );
}
