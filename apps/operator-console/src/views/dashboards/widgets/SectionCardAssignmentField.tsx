import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { getAssignableDevicesForSectionCard } from '../dashboardUtils';
import type { AssignableAutomation, AssignableDisplayAction, AssignableScene, CardDraft } from './sectionCardCatalog';
import { normalizeKind } from './sectionCardCatalog';
import { toAutomationEntityId, toDeviceActionEntityId } from './sectionCardAssignments';
import { applyControlSelection, applyDeviceSelection, applyRoomSelection, applySceneSelection } from './sectionCardEditorModel';

interface SectionCardAssignmentFieldProps {
  cardDraft: CardDraft;
  setCardDraft: Dispatch<SetStateAction<CardDraft>>;
  assignableDevices: SnapshotDevice[];
  assignableRooms: SnapshotRoom[];
  scenes: AssignableScene[];
  automations: AssignableAutomation[];
  displayActions: AssignableDisplayAction[];
  devices: SnapshotDevice[];
}

/** Entity picker for bindable card kinds (scene, room, control or device) plus the assignment note. */
export function SectionCardAssignmentField({
  cardDraft, setCardDraft, assignableDevices, assignableRooms, scenes, automations, displayActions, devices,
}: SectionCardAssignmentFieldProps) {
  const { t } = useTranslation();
  const kind = normalizeKind(cardDraft.kind);
  const automationOptions = automations.map((automation) => ({
    value: toAutomationEntityId(automation.id),
    label: automation.enabled ? automation.name : `${automation.name} (${t('dashboard.editor.sections.routine_disabled')})`,
    description: t('dashboard.editor.sections.routine_option_tag'),
  }));
  const sceneOptions = scenes.map((scene) => ({
    value: scene.id,
    label: scene.name,
    description: t('dashboard.editor.sections.scene_option_tag'),
  }));
  const deviceOptions = assignableDevices.map((device) => ({
    value: device.id,
    label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
  }));

  return (
    <div className="space-y-2">
      {kind === 'scene' ? (
        <SearchableSelectField
          label={t('dashboard.editor.sections.assigned_scene')}
          value={cardDraft.entityId}
          placeholder={t('dashboard.editor.sections.unassigned')}
          options={[
            { value: '', label: t('dashboard.editor.sections.unassigned') },
            ...sceneOptions,
            ...automationOptions,
          ]}
          onChange={(selectedId) => {
            setCardDraft((draft) => applySceneSelection(draft, selectedId, scenes, automations));
          }}
        />
      ) : kind === 'room' ? (
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
            setCardDraft((draft) => applyRoomSelection(draft, selectedId, assignableRooms));
          }}
        />
      ) : kind === 'action' || kind === 'light' ? (
        <SearchableSelectField
          label={t('dashboard.editor.sections.assigned_control')}
          value={cardDraft.entityId}
          placeholder={t('dashboard.editor.sections.unassigned')}
          placement="down"
          options={[
            { value: '', label: t('dashboard.editor.sections.unassigned') },
            ...deviceOptions,
            ...sceneOptions,
            ...automationOptions,
            ...displayActions.map((action) => ({
              value: toDeviceActionEntityId(action.deviceId, action.actionKey),
              label: action.displayName,
              description: t('dashboard.editor.sections.display_action_option_tag', { name: action.deviceName }),
            })),
          ]}
          onChange={(selectedId) => {
            const isLightDevice = (deviceId: string) => getAssignableDevicesForSectionCard('light', devices).some((device) => device.id === deviceId);
            setCardDraft((draft) => applyControlSelection(draft, selectedId, { devices, scenes, automations, displayActions, isLightDevice }));
          }}
        />
      ) : (
        <SearchableSelectField
          label={t('dashboard.editor.sections.assigned_device')}
          value={cardDraft.entityId}
          placeholder={t('dashboard.editor.sections.unassigned')}
          options={[
            { value: '', label: t('dashboard.editor.sections.unassigned') },
            ...deviceOptions,
          ]}
          onChange={(selectedId) => {
            setCardDraft((draft) => applyDeviceSelection(draft, selectedId, devices));
          }}
        />
      )}

      <p className="text-caption font-semibold text-muted-foreground">
        {t('dashboard.editor.sections.assignment_note')}
      </p>
    </div>
  );
}
