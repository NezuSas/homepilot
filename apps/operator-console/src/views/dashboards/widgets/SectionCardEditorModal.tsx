import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPicker } from '../components/IconPicker';
import { getClockGridOptions } from './clock/clockRegistry';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { NumberInput } from '../../../components/ui/NumberInput';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { CardColumns, CardGridOptions } from '../types';
import { normalizeSensorScale, normalizeSensorVisualStyle, sensorVisualStyles, type SensorVisualStyle, type SensorScale } from './sectionCardCatalog';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { getAssignableDevicesForSectionCard } from '../dashboardUtils';
import { Modal } from '../../../components/ui/Modal';
import { CardGridSizePicker } from './CardGridSizePicker';
import { CardPreviewFrame } from './CardPreviewFrame';
import {
  cardKinds, getDefaultIcon, getDefaultSpan,
  isBindableKind, isClockKind,
  normalizeKind, type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type CardDraft,
  type MediaVariant, type NormalizedSectionCardKind, type SectionCardIcon, type SectionCardKind, type SectionCardSpan,
} from './sectionCardCatalog';
import { isAutomationEntityId, stripAutomationEntityPrefix, toAutomationEntityId, toDeviceActionEntityId } from './sectionCardAssignments';

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
  const defaultColumns = cardDraft.span === 'full' ? 12 : cardDraft.span === 'small' ? 3 : 6;
  const clock = isClockKind(cardDraft.kind);
  const sensor = cardDraft.kind === 'sensor';
  const minimum = sensor ? 4 : 2;
  const gridOptions: CardGridOptions = clock ? getClockGridOptions(cardDraft.gridOptions) : sensor ? { ...cardDraft.gridOptions, columns: Math.max(minimum, typeof cardDraft.gridOptions?.columns === 'number' ? cardDraft.gridOptions.columns : defaultColumns) as CardColumns, rows: typeof cardDraft.gridOptions?.rows === 'number' ? Math.max(minimum, cardDraft.gridOptions.rows) : 'auto', minColumns: minimum as CardColumns, minRows: minimum } : cardDraft.gridOptions ?? { columns: defaultColumns as CardColumns, rows: 'auto' };
  const sensorScale = normalizeSensorScale({ min: cardDraft.sensorMin, max: cardDraft.sensorMax });
  const invalidScale = cardDraft.kind === 'sensor' && (!validMinimum || !validMaximum || ((cardDraft.sensorMin !== undefined || cardDraft.sensorMax !== undefined) && !sensorScale));
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
            <h3 className="mb-3 text-body-compact font-semibold">{t('dashboards.edit_session.preview')}</h3>
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
            <SegmentedControl layout="scroll" className="card-editor-tabs" optionClassName="min-h-11 normal-case tracking-normal" value={panel} onChange={setPanel} label={t('dashboards.edit_session.label')} options={(isBadgeRow ? ['configuration', 'visibility'] as const : ['configuration', 'design', 'visibility'] as const).map(value => ({ value, label: t(`dashboards.edit_session.${value}`) }))} />
            {panel === 'design' && <CardGridSizePicker value={gridOptions} allowAutomatic={!clock} onChange={next => setCardDraft(draft => ({ ...draft, gridOptions: clock ? getClockGridOptions(next) : next }))} />}
            {panel === 'visibility' && <ToggleSwitch label={t('dashboards.edit_session.visible')} checked={!cardDraft.hidden} onCheckedChange={visible => setCardDraft(draft => ({ ...draft, hidden: !visible }))} />}
            <div hidden={panel !== 'configuration'} className="space-y-4">
            {cardDraft.kind.startsWith('info_') && <SearchableSelectField
              label={t('dashboard.editor.sections.information_source')} value={cardDraft.kind}
              options={(['info_time', 'info_weather', 'info_sensor'] as const).map(value => ({ value, label: t(`dashboard.editor.sections.${value}`) }))}
              onChange={value => {
                if (value !== 'info_time' && value !== 'info_weather' && value !== 'info_sensor') return;
                setCardDraft(draft => ({ ...draft, kind: value, entityId: '', icon: getDefaultIcon(value) }));
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

            {cardDraft.kind === 'sensor' && <fieldset className="space-y-2">
              <legend className="text-caption font-semibold text-foreground">{t('dashboard.editor.sections.sensor_scale_settings')}</legend>
              <SearchableSelectField label={t('dashboard.editor.sections.sensor_visualization')} value={cardDraft.visualStyle ?? 'gauge'}
                options={sensorVisualStyles.map(value => ({ value, label: t(`dashboard.editor.sections.sensor_visual_${value}`) }))}
                onChange={value => setCardDraft(draft => ({ ...draft, visualStyle: normalizeSensorVisualStyle(value) }))} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-compact">{t('dashboard.editor.sections.sensor_decimals')}</span>
                <ToggleSwitch label={t('dashboard.editor.sections.sensor_decimals')} checked={cardDraft.sensorDecimals === true} onCheckedChange={sensorDecimals => setCardDraft(draft => ({ ...draft, sensorDecimals }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label={t('dashboard.editor.sections.sensor_min')} required={false} step="any" value={cardDraft.sensorMin}
                  onValidityChange={setValidMinimum}
                  onValueChange={sensorMin => setCardDraft(draft => ({ ...draft, sensorMin }))} onEmpty={() => setCardDraft(draft => ({ ...draft, sensorMin: undefined }))} />
                <NumberInput label={t('dashboard.editor.sections.sensor_max')} required={false} step="any" value={cardDraft.sensorMax}
                  onValidityChange={setValidMaximum}
                  onValueChange={sensorMax => setCardDraft(draft => ({ ...draft, sensorMax }))} onEmpty={() => setCardDraft(draft => ({ ...draft, sensorMax: undefined }))} />
              </div>
              <p role={invalidScale ? 'alert' : undefined} className="text-caption text-muted-foreground">{t(invalidScale ? 'dashboard.editor.sections.sensor_scale_invalid' : 'dashboard.editor.sections.sensor_scale_hint')}</p>
            </fieldset>}

            <Input
              label={t('dashboard.editor.sections.name')}
              value={cardDraft.title}
              onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
              className="h-12 rounded-2xl border-border/60 bg-background/60 px-4 font-semibold"
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
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind === 'light' && draft.kind === 'action' ? 'action' : nextKind,
                    entityId: isBindableKind(nextKind) && (normalizeKind(draft.kind) === normalizeKind(nextKind) || (nextKind === 'light' && draft.kind === 'action')) ? draft.entityId : '',
                    span: nextKind === 'light' && draft.kind === 'action' ? draft.span : getDefaultSpan(nextKind),
                    icon: nextKind === 'light' && draft.kind === 'action' ? draft.icon : getDefaultIcon(nextKind),
                    title: draft.title || catalogLabel(nextKind),
                  }));
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
              <div className="space-y-2">
                {normalizeKind(cardDraft.kind) === 'scene' ? (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_scene')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...scenes.map((scene) => ({
                        value: scene.id,
                        label: scene.name,
                        description: t('dashboard.editor.sections.scene_option_tag'),
                      })),
                      ...automations.map((automation) => ({
                        value: toAutomationEntityId(automation.id),
                        label: automation.enabled ? automation.name : `${automation.name} (${t('dashboard.editor.sections.routine_disabled')})`,
                        description: t('dashboard.editor.sections.routine_option_tag'),
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextName = isAutomationEntityId(selectedId)
                        ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(selectedId))?.name
                        : scenes.find((scene) => scene.id === selectedId)?.name;
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextName || draft.title,
                      }));
                    }}
                  />
                ) : normalizeKind(cardDraft.kind) === 'room' ? (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_room')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...assignableRooms.map((room) => ({
                        value: room.id,
                        label: room.name,
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextRoom = assignableRooms.find((room) => room.id === selectedId);
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextRoom?.name || draft.title,
                      }));
                    }}
                  />
                ) : normalizeKind(cardDraft.kind) === 'action' || normalizeKind(cardDraft.kind) === 'light' ? (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_control')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    placement="down"
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...assignableDevices.map((device) => ({
                        value: device.id,
                        label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
                      })),
                      ...scenes.map((scene) => ({
                        value: scene.id,
                        label: scene.name,
                        description: t('dashboard.editor.sections.scene_option_tag'),
                      })),
                      ...automations.map((automation) => ({
                        value: toAutomationEntityId(automation.id),
                        label: automation.enabled ? automation.name : `${automation.name} (${t('dashboard.editor.sections.routine_disabled')})`,
                        description: t('dashboard.editor.sections.routine_option_tag'),
                      })),
                      ...displayActions.map((action) => ({
                        value: toDeviceActionEntityId(action.deviceId, action.actionKey),
                        label: action.displayName,
                        description: t('dashboard.editor.sections.display_action_option_tag', { name: action.deviceName }),
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextDisplayAction = displayActions.find((action) =>
                        toDeviceActionEntityId(action.deviceId, action.actionKey) === selectedId);
                      const nextDevice = devices.find((device) => device.id === selectedId);
                      const nextName = nextDisplayAction?.displayName || nextDevice?.name
                        || scenes.find((scene) => scene.id === selectedId)?.name
                        || (isAutomationEntityId(selectedId)
                          ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(selectedId))?.name
                          : undefined);
                      const isLightTarget = !nextDisplayAction && (!selectedId || getAssignableDevicesForSectionCard('light', devices).some((device) => device.id === selectedId));
                      const nextKind = isLightTarget ? 'light' : 'action';
                      setCardDraft((draft) => ({
                        ...draft,
                        kind: nextKind,
                        entityId: selectedId,
                        title: nextName || draft.title,
                        icon: draft.icon === getDefaultIcon(draft.kind) ? getDefaultIcon(nextKind) : draft.icon,
                      }));
                    }}
                  />
                ) : (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_device')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...assignableDevices.map((device) => ({
                        value: device.id,
                        label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextDevice = devices.find((device) => device.id === selectedId);
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextDevice?.name || draft.title,
                      }));
                    }}
                  />
                )}

                <p className="text-caption font-semibold text-muted-foreground">
                  {t('dashboard.editor.sections.assignment_note')}
                </p>
              </div>
            ) : null}
            </div>
            </div>
          </div>

    </Modal>
  );
}
