import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../config';
import { fetchDiagnosticResource } from '../../../lib/diagnosticResourceRequests';
import { apiFetch } from '../../../lib/apiClient';
import { normalizeAssignableAutomation, normalizeAssignableDisplayAction, normalizeAssignableScene } from './sectionCardAssignments';
import { normalizeKind, type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type NormalizedSectionCardKind } from './sectionCardCatalog';

interface AssignableSourcesOptions {
  badgeRow: boolean;
  /** Kind of the card currently being edited. */
  draftKind: NormalizedSectionCardKind;
  editingCardId: string | null;
  hasRoutineAction: boolean;
  isCatalogOpen: boolean;
}

/** Loads the scenes, automations and display actions a section card can be bound to, only while they are needed. */
export function useAssignableSources({ badgeRow, draftKind, editingCardId, hasRoutineAction, isCatalogOpen }: AssignableSourcesOptions) {
  const [scenes, setScenes] = useState<AssignableScene[]>([]);
  const [automations, setAutomations] = useState<AssignableAutomation[]>([]);
  const [displayActions, setDisplayActions] = useState<AssignableDisplayAction[]>([]);

  useEffect(() => {
    if (badgeRow) return;
    if (!hasRoutineAction && !isCatalogOpen && (!editingCardId || (normalizeKind(draftKind) !== 'scene' && normalizeKind(draftKind) !== 'action' && normalizeKind(draftKind) !== 'light'))) return;

    const controller = new AbortController();
    void fetchDiagnosticResource(`${API_BASE_URL}/api/v1/scenes`, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw new Error(`SCENES_${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
          .map(normalizeAssignableScene)
          .filter((scene): scene is AssignableScene => Boolean(scene))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
      })
      .then((nextScenes) => {
        if (!controller.signal.aborted) setScenes(nextScenes);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('[SectionWidget] Failed to load scenes:', error);
          setScenes([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [draftKind, editingCardId, hasRoutineAction, isCatalogOpen, badgeRow]);

  useEffect(() => {
    if (badgeRow) return;
    if (!editingCardId || (normalizeKind(draftKind) !== 'action' && normalizeKind(draftKind) !== 'light')) return;
    const controller = new AbortController();
    void apiFetch(`${API_BASE_URL}/api/v1/dashboard-action-targets`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('DASHBOARD_ACTION_TARGETS_UNAVAILABLE');
        const payload: unknown = await response.json();
        return Array.isArray(payload)
          ? payload.map(normalizeAssignableDisplayAction).filter((action): action is AssignableDisplayAction => action !== null)
          : [];
      }).then((actions) => { if (!controller.signal.aborted) setDisplayActions(actions); })
      .catch(() => { if (!controller.signal.aborted) setDisplayActions([]); });
    return () => controller.abort();
  }, [draftKind, editingCardId, badgeRow]);

  useEffect(() => {
    if (!hasRoutineAction && !isCatalogOpen && (!editingCardId || (normalizeKind(draftKind) !== 'scene' && normalizeKind(draftKind) !== 'action' && normalizeKind(draftKind) !== 'light'))) return;

    const controller = new AbortController();
    void fetchDiagnosticResource(`${API_BASE_URL}/api/v1/automations`, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw new Error(`AUTOMATIONS_${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
          .map(normalizeAssignableAutomation)
          .filter((automation): automation is AssignableAutomation => Boolean(automation))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
      })
      .then((nextAutomations) => {
        if (!controller.signal.aborted) setAutomations(nextAutomations);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('[SectionWidget] Failed to load automations:', error);
          setAutomations([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [draftKind, editingCardId, hasRoutineAction, isCatalogOpen]);

  return { scenes, automations, displayActions };
}
