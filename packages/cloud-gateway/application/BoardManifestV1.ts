import { isValidCommand, type DeviceCommandV1 } from '../../devices/domain/commands';

export const BOARD_MANIFEST_SCHEMA_VERSION = 'homepilot.board-manifest.v1' as const;

export type ManifestControlType = 'button' | 'slider';
export type ManifestVisibility = 'visible' | 'hidden';
export type ManifestSafetyLevel = 'normal' | 'sensitive';

export interface BoardManifestActionV1 {
  readonly key: string;
  readonly displayName: string;
  readonly semanticAction: DeviceCommandV1;
  readonly controlType: ManifestControlType;
  readonly implementationType: 'homepilot';
  readonly implementationConfig: Record<string, never>;
  readonly visibility: ManifestVisibility;
  readonly safetyLevel: ManifestSafetyLevel;
  readonly requiresConfirmation: boolean;
}

export interface BoardManifestEntitlementCommandV1 {
  readonly key: string;
  readonly displayName: string;
  readonly implementationType: 'legacy_adb' | 'homepilot';
  readonly controlType: ManifestControlType;
  readonly visibility: ManifestVisibility;
  readonly safetyLevel: ManifestSafetyLevel;
  readonly requiresConfirmation: boolean;
}

export interface BoardManifestEntitlementV1 {
  readonly plan: { readonly id: number; readonly name: string; readonly type: string };
  readonly commands: ReadonlyArray<BoardManifestEntitlementCommandV1>;
}

export interface BoardManifestV1 {
  readonly schemaVersion: typeof BOARD_MANIFEST_SCHEMA_VERSION;
  readonly revision: string;
  readonly boardId: number;
  readonly installationId: string;
  readonly homePilotDeviceId: string;
  readonly planId: number;
  readonly actions: ReadonlyArray<BoardManifestActionV1>;
  readonly entitlement?: BoardManifestEntitlementV1;
}

export class BoardManifestValidationError extends Error {
  readonly code = 'BOARD_MANIFEST_INVALID';

  constructor() {
    super('BOARD_MANIFEST_INVALID');
    this.name = 'BoardManifestValidationError';
  }
}

const manifestKeys = [
  'schemaVersion', 'revision', 'boardId', 'installationId',
  'homePilotDeviceId', 'planId', 'actions',
] as const;
const actionKeys = [
  'key', 'displayName', 'semanticAction', 'controlType', 'implementationType',
  'implementationConfig', 'visibility', 'safetyLevel', 'requiresConfirmation',
] as const;
const entitlementCommandKeys = [
  'key', 'displayName', 'implementationType', 'controlType', 'visibility',
  'safetyLevel', 'requiresConfirmation',
] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const revisionPattern = /^[0-9a-f]{64}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, keys: ReadonlyArray<string>): value is Record<string, unknown> {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

function parseAction(value: unknown): BoardManifestActionV1 {
  if (!hasExactKeys(value, actionKeys)
    || typeof value.key !== 'string' || !value.key.trim() || value.key !== value.key.trim()
    || typeof value.displayName !== 'string' || !value.displayName.trim()
    || typeof value.semanticAction !== 'string' || !isValidCommand(value.semanticAction)
    || (value.controlType !== 'button' && value.controlType !== 'slider')
    || value.implementationType !== 'homepilot'
    || !isPlainObject(value.implementationConfig)
    || Object.keys(value.implementationConfig).length !== 0
    || (value.visibility !== 'visible' && value.visibility !== 'hidden')
    || (value.safetyLevel !== 'normal' && value.safetyLevel !== 'sensitive')
    || typeof value.requiresConfirmation !== 'boolean'
    || (value.safetyLevel === 'sensitive' && !value.requiresConfirmation)) {
    throw new BoardManifestValidationError();
  }

  return {
    key: value.key,
    displayName: value.displayName,
    semanticAction: value.semanticAction,
    controlType: value.controlType,
    implementationType: 'homepilot',
    implementationConfig: {},
    visibility: value.visibility,
    safetyLevel: value.safetyLevel,
    requiresConfirmation: value.requiresConfirmation,
  };
}

function parseEntitlement(value: unknown): BoardManifestEntitlementV1 {
  if (!hasExactKeys(value, ['plan', 'commands'])
    || !hasExactKeys(value.plan, ['id', 'name', 'type'])
    || !isPositiveInteger(value.plan.id)
    || typeof value.plan.name !== 'string' || !value.plan.name.trim()
    || typeof value.plan.type !== 'string' || !value.plan.type.trim()
    || !Array.isArray(value.commands)) throw new BoardManifestValidationError();

  const commands: BoardManifestEntitlementCommandV1[] = value.commands.map((item: unknown) => {
    if (!hasExactKeys(item, entitlementCommandKeys)
      || typeof item.key !== 'string' || !item.key.trim() || item.key !== item.key.trim()
      || typeof item.displayName !== 'string' || !item.displayName.trim()
      || (item.implementationType !== 'legacy_adb' && item.implementationType !== 'homepilot')
      || (item.controlType !== 'button' && item.controlType !== 'slider')
      || (item.visibility !== 'visible' && item.visibility !== 'hidden')
      || (item.safetyLevel !== 'normal' && item.safetyLevel !== 'sensitive')
      || typeof item.requiresConfirmation !== 'boolean') throw new BoardManifestValidationError();
    return {
      key: item.key, displayName: item.displayName,
      implementationType: item.implementationType, controlType: item.controlType,
      visibility: item.visibility, safetyLevel: item.safetyLevel,
      requiresConfirmation: item.requiresConfirmation,
    };
  });
  if (new Set(commands.map((item) => item.key)).size !== commands.length) throw new BoardManifestValidationError();
  return { plan: { id: value.plan.id, name: value.plan.name, type: value.plan.type }, commands };
}

/** Runtime validation at the external IntentFlow manifest boundary. */
export function parseBoardManifestV1(value: unknown): BoardManifestV1 {
  if (!(hasExactKeys(value, manifestKeys) || hasExactKeys(value, [...manifestKeys, 'entitlement']))
    || value.schemaVersion !== BOARD_MANIFEST_SCHEMA_VERSION
    || typeof value.revision !== 'string' || !revisionPattern.test(value.revision)
    || !isPositiveInteger(value.boardId) || !isPositiveInteger(value.planId)
    || !isUuid(value.installationId) || !isUuid(value.homePilotDeviceId)
    || !Array.isArray(value.actions)) {
    throw new BoardManifestValidationError();
  }

  const actions = value.actions.map((action: unknown) => parseAction(action));
  if (new Set(actions.map((action) => action.key)).size !== actions.length) {
    throw new BoardManifestValidationError();
  }
  const entitlement = 'entitlement' in value ? parseEntitlement(value.entitlement) : undefined;
  if (entitlement && entitlement.plan.id !== value.planId) {
    throw new BoardManifestValidationError();
  }

  return {
    schemaVersion: BOARD_MANIFEST_SCHEMA_VERSION,
    revision: value.revision,
    boardId: value.boardId,
    installationId: value.installationId,
    homePilotDeviceId: value.homePilotDeviceId,
    planId: value.planId,
    actions,
    ...(entitlement ? { entitlement } : {}),
  };
}
