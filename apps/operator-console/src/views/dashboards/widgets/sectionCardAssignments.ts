import { API_BASE_URL } from '../../../config';
import type { SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { AssignableAutomation, AssignableScene } from './sectionCardCatalog';

const AUTOMATION_ENTITY_PREFIX = 'automation:';

export function toAutomationEntityId(automationId: string): string {
  return `${AUTOMATION_ENTITY_PREFIX}${automationId}`;
}

export function getAssignableRooms(roomsByHome: Record<string, SnapshotRoom[]>) {
  return Object.values(roomsByHome)
    .flat()
    .filter((room) => room.id && room.name)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

export function normalizeAssignableScene(rawScene: unknown): AssignableScene | null {
  if (!rawScene || typeof rawScene !== 'object') return null;
  const scene = rawScene as Record<string, unknown>;
  if (typeof scene.id !== 'string') return null;
  return { id: scene.id, name: typeof scene.name === 'string' && scene.name.trim() ? scene.name : 'Escena' };
}

export function isAutomationEntityId(entityId?: string): boolean {
  return typeof entityId === 'string' && entityId.startsWith(AUTOMATION_ENTITY_PREFIX);
}

export function stripAutomationEntityPrefix(entityId: string): string {
  return entityId.slice(AUTOMATION_ENTITY_PREFIX.length);
}

export function getSceneOrRoutineUrl(entityId: string): string {
  const isRoutine = isAutomationEntityId(entityId);
  const targetId = isRoutine ? stripAutomationEntityPrefix(entityId) : entityId;
  return isRoutine
    ? `${API_BASE_URL}/api/v1/automations/${encodeURIComponent(targetId)}/run`
    : `${API_BASE_URL}/api/v1/scenes/${encodeURIComponent(targetId)}/execute`;
}

export function normalizeAssignableAutomation(rawAutomation: unknown): AssignableAutomation | null {
  if (!rawAutomation || typeof rawAutomation !== 'object') return null;
  const automation = rawAutomation as Record<string, unknown>;
  if (typeof automation.id !== 'string') return null;
  return { id: automation.id, name: typeof automation.name === 'string' && automation.name.trim() ? automation.name : 'Rutina', enabled: automation.enabled !== false };
}
