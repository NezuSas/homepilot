import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconPicker } from '../components/IconPicker';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { getAssignableDevicesForSectionCard } from '../dashboardUtils';
import { ModalPortal } from './ModalPortal';
import {
  canUseCompactSpan, cardKinds, getDefaultIcon, getDefaultSpan,
  getEffectiveCardSpan, isBindableKind, isClockKind,
  normalizeKind, type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type CardDraft,
  type NormalizedSectionCardKind, type SectionCardIcon, type SectionCardKind, type SectionCardSpan,
} from './sectionCardCatalog';
import { isAutomationEntityId, stripAutomationEntityPrefix, toAutomationEntityId, toDeviceActionEntityId } from './sectionCardAssignments';

const DESKTOP_SECTION_COLUMNS = 4;

interface SectionCardEditorModalProps {
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
  ) => ReactNode;
  onClose: () => void;
  onSave: () => void;
}

export function SectionCardEditorModal({
  cardDraft, setCardDraft, catalogLabel, assignableDevices, assignableRooms,
  scenes, automations, displayActions, devices, renderCatalogPreview, onClose, onSave,
}: SectionCardEditorModalProps) {
  const { t } = useTranslation();
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99999] grid place-items-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
      >
        <div
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-panel border border-border/60 bg-card shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-5 py-4">
            <div>
              <p className="text-caption font-black uppercase tracking-label text-muted-foreground">
                {t('dashboard.editor.sections.edit')}
              </p>
              <h3 className="text-panel-title font-black text-foreground">
                {t('common.edit')}
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

          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {renderCatalogPreview(
              cardDraft.kind,
              cardDraft.title || catalogLabel(cardDraft.kind),
              cardDraft.span,
              cardDraft.icon,
              normalizeKind(cardDraft.kind) === 'camera' || normalizeKind(cardDraft.kind) === 'cover' || normalizeKind(cardDraft.kind) === 'room' || normalizeKind(cardDraft.kind) === 'sensor' || normalizeKind(cardDraft.kind) === 'media' || normalizeKind(cardDraft.kind) === 'action' ? cardDraft.entityId : undefined,
            )}

            <Input
              label={t('dashboard.editor.sections.name')}
              value={cardDraft.title}
              onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
              className="h-12 rounded-2xl border-border/60 bg-background/60 px-4 font-semibold"
            />

            {!isClockKind(cardDraft.kind) && (
              <SearchableSelectField
                label={t('dashboard.editor.sections.card_type')}
                value={cardDraft.kind === 'action' ? 'light' : cardDraft.kind}
                options={cardKinds
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

            {!isClockKind(cardDraft.kind) && normalizeKind(cardDraft.kind) !== 'media' && (
              <SearchableSelectField
                label={t('dashboard.editor.sections.card_size')}
                value={cardDraft.span}
                placement="down"
                options={[
                  ...(canUseCompactSpan(cardDraft.kind)
                    ? [{ value: 'small', label: t('dashboard.editor.sections.card_size_small', { count: DESKTOP_SECTION_COLUMNS }) }]
                    : []),
                  { value: 'medium', label: t('dashboard.editor.sections.card_size_medium', { count: Math.max(1, Math.floor(DESKTOP_SECTION_COLUMNS / 2)) }) },
                  { value: 'full', label: t('dashboard.editor.sections.card_size_full') },
                ]}
                onChange={(value) => setCardDraft((draft) => ({
                  ...draft,
                  span: getEffectiveCardSpan(draft.kind, value as SectionCardSpan),
                }))}
              />
            )}


            {(cardDraft.kind === 'light' || cardDraft.kind === 'action' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
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

          <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 px-5 py-4">
            <Button type="button" onClick={() => onClose()} variant="secondary" size="md">
              {t('dashboard.editor.sections.cancel')}
            </Button>

            <Button type="button" onClick={onSave} variant="primary" size="md">
              {t('dashboard.editor.sections.save')}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
