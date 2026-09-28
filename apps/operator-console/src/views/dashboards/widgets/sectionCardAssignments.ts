import { API_BASE_URL } from '../../../config';
import type { SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { AssignableAutomation, AssignableDisplayAction, AssignableScene } from './sectionCardCatalog';

const AUTOMATION_ENTITY_PREFIX = 'automation:';
const DEVICE_ACTION_PREFIX = 'device-action:';
const DEVICE_ACTION_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function toDeviceActionEntityId(deviceId: string, actionKey: string): string {
  if (!DEVICE_ACTION_SEGMENT.test(deviceId) || !DEVICE_ACTION_SEGMENT.test(actionKey)) {
    throw new Error('INVALID_DEVICE_ACTION_TARGET');
  }
  return `${DEVICE_ACTION_PREFIX}${deviceId}:${actionKey}`;
}

export function parseDeviceActionEntityId(entityId: string): { deviceId: string; actionKey: string } | null {
  if (!entityId.startsWith(DEVICE_ACTION_PREFIX)) return null;
  const match = /^device-action:([A-Za-z0-9._-]+):([A-Za-z0-9._-]+)$/.exec(entityId);
  return match ? { deviceId: match[1], actionKey: match[2] } : null;
}

export function isDeviceActionEntityId(entityId?: string): boolean {
  return typeof entityId === 'string' && entityId.startsWith(DEVICE_ACTION_PREFIX);
}

export function normalizeAssignableDisplayAction(value: unknown): AssignableDisplayAction | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.deviceId !== 'string' || !DEVICE_ACTION_SEGMENT.test(item.deviceId)
    || typeof item.actionKey !== 'string' || !DEVICE_ACTION_SEGMENT.test(item.actionKey)
    || typeof item.displayName !== 'string' || !item.displayName.trim()
    || typeof item.deviceName !== 'string' || !item.deviceName.trim()) return null;
  return { deviceId: item.deviceId, actionKey: item.actionKey,
    displayName: item.displayName, deviceName: item.deviceName };
}

export function getDeviceActionExecuteUrl(entityId: string): string | null {
  const target = parseDeviceActionEntityId(entityId);
  return target ? `${API_BASE_URL}/api/v1/devices/${encodeURIComponent(target.deviceId)}/actions/${encodeURIComponent(target.actionKey)}/execute` : null;
}

export async function executeDeviceActionTarget(
  entityId: string,
  request: (url: string, init: RequestInit) => Promise<Response>,
): Promise<unknown> {
  const url = getDeviceActionExecuteUrl(entityId);
  if (!url) throw new Error('INVALID_DEVICE_ACTION_TARGET');
  const response = await request(url, { method: 'POST' });
  if (!response.ok) throw new Error(`DEVICE_ACTION_${response.status}`);
  return response.json() as Promise<unknown>;
}

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
