import type { Device } from '../../devices/domain/types';
import { CAPABILITY_DEFINITIONS } from '../../devices/domain/capabilities';
import { validateDeviceCommand } from '../../devices/domain/CommandCapabilityValidator';
import { BoardManifestValidationError, parseBoardManifestV1 } from './BoardManifestV1';
import { EffectiveActionsIdentityError, resolveEffectiveActions } from './EffectiveActionsResolver';

const deviceId = '33dfef68-0d46-4fdd-aef0-8b249a32de4e';
const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';

const smartDisplay: Device = {
  id: deviceId,
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: `android-display:${deviceId}`,
  name: 'Pantalla de sala',
  type: 'smart_display',
  semanticType: 'smart_display',
  vendor: 'Droidlogic',
  status: 'ASSIGNED',
  integrationSource: 'android-display',
  invertState: false,
  lastKnownState: { connectionState: 'online' },
  entityVersion: 1,
  createdAt: '2026-09-27T00:00:00Z',
  updatedAt: '2026-09-27T00:00:00Z',
};

function action(key: string, semanticAction: string) {
  return {
    key,
    displayName: key,
    semanticAction,
    controlType: semanticAction === 'volume_set' ? 'slider' : 'button',
    implementationType: 'homepilot',
    implementationConfig: {},
    visibility: 'visible',
    safetyLevel: 'normal',
    requiresConfirmation: false,
  };
}

function manifest() {
  return {
    schemaVersion: 'homepilot.board-manifest.v1',
    revision: 'a'.repeat(64),
    boardId: 5,
    installationId,
    homePilotDeviceId: deviceId,
    planId: 2,
    actions: [
      action('hp_volume_set', 'volume_set'),
      action('hp_navigate_home', 'navigate_home'),
      action('hp_navigate_back', 'navigate_back'),
    ],
  };
}

describe('Board manifest v1 runtime boundary', () => {
  it('accepts the exact valid manifest and three known Smart Display actions', () => {
    expect(parseBoardManifestV1(manifest()).actions.map((entry) => entry.semanticAction)).toEqual([
      'volume_set', 'navigate_home', 'navigate_back',
    ]);
  });

  it.each([
    { name: 'wrong schema', mutate: (value: ReturnType<typeof manifest>) => { value.schemaVersion = 'homepilot.board-manifest.v2'; } },
    { name: 'bad revision', mutate: (value: ReturnType<typeof manifest>) => { value.revision = 'not-sha256'; } },
    { name: 'invalid installation UUID', mutate: (value: ReturnType<typeof manifest>) => { value.installationId = 'bad'; } },
    { name: 'invalid device UUID', mutate: (value: ReturnType<typeof manifest>) => { value.homePilotDeviceId = 'bad'; } },
    { name: 'nonpositive board id', mutate: (value: ReturnType<typeof manifest>) => { value.boardId = 0; } },
    { name: 'nonpositive plan id', mutate: (value: ReturnType<typeof manifest>) => { value.planId = 0; } },
    { name: 'other implementation type', mutate: (value: ReturnType<typeof manifest>) => { value.actions[0].implementationType = 'adb'; } },
    { name: 'unknown semantic action', mutate: (value: ReturnType<typeof manifest>) => { value.actions[0].semanticAction = 'shell'; } },
    { name: 'nonempty implementation config', mutate: (value: ReturnType<typeof manifest>) => { (value.actions[0].implementationConfig as Record<string, unknown>).command = 'input keyevent 3'; } },
    { name: 'duplicate action key', mutate: (value: ReturnType<typeof manifest>) => { value.actions[1].key = value.actions[0].key; } },
    { name: 'sensitive without confirmation', mutate: (value: ReturnType<typeof manifest>) => { value.actions[0].safetyLevel = 'sensitive'; } },
  ])('rejects $name', ({ mutate }) => {
    const input = manifest();
    mutate(input);
    expect(() => parseBoardManifestV1(input)).toThrow(BoardManifestValidationError);
  });

  it('rejects unexpected root/action fields and non-plain config', () => {
    expect(() => parseBoardManifestV1({ ...manifest(), token: 'never-accepted' })).toThrow(BoardManifestValidationError);
    const extraAction = manifest();
    expect(() => parseBoardManifestV1({ ...extraAction, actions: [{ ...extraAction.actions[0], adbIdentifier: 'legacy' }] }))
      .toThrow(BoardManifestValidationError);
    const nonPlainConfig = manifest();
    expect(() => parseBoardManifestV1({ ...nonPlainConfig, actions: [{ ...nonPlainConfig.actions[0], implementationConfig: new Date() }] }))
      .toThrow(BoardManifestValidationError);
  });
});

describe('EffectiveActionsResolver local policy', () => {
  it('returns exactly navigate_home, navigate_back and volume_set for an assigned Smart Display', () => {
    const effective = resolveEffectiveActions(manifest(), smartDisplay);
    expect(effective.map((entry) => entry.semanticAction)).toEqual(['navigate_back', 'navigate_home', 'volume_set']);
    expect(effective.map((entry) => [entry.semanticAction, entry.controlType])).toEqual([
      ['navigate_back', 'button'],
      ['navigate_home', 'button'],
      ['volume_set', 'slider'],
    ]);
    expect(effective).toHaveLength(3);
    expect(CAPABILITY_DEFINITIONS.smart_display.map((entry) => entry.name)).toEqual([
      'navigate_home', 'navigate_back', 'volume_set',
    ]);
  });

  it('excludes volume_set when the remote manifest calls it a button', () => {
    const input = manifest();
    input.actions[0].controlType = 'button';

    expect(resolveEffectiveActions(input, smartDisplay).map((entry) => entry.semanticAction)).toEqual([
      'navigate_back',
      'navigate_home',
    ]);
  });

  it('excludes navigate_home when the remote manifest calls it a slider', () => {
    const input = manifest();
    input.actions[1].controlType = 'slider';

    expect(resolveEffectiveActions(input, smartDisplay).map((entry) => entry.semanticAction)).toEqual([
      'navigate_back',
      'volume_set',
    ]);
  });

  it('does not represent a local command with an unsupported parameter schema', () => {
    const input = manifest();
    input.actions = [{ ...action('hp_temperature', 'set_temperature'), controlType: 'slider' }];
    const climateDevice: Device = {
      ...smartDisplay,
      type: 'climate',
      semanticType: 'unknown',
      integrationSource: 'local',
      externalId: 'local:climate',
    };

    expect(resolveEffectiveActions(input, climateDevice)).toEqual([]);
  });

  it('excludes a globally known command that Smart Display does not support', () => {
    const input = manifest();
    input.actions.push(action('hp_turn_on', 'turn_on'));
    expect(resolveEffectiveActions(input, smartDisplay).map((entry) => entry.key)).toEqual([
      'hp_navigate_back', 'hp_navigate_home', 'hp_volume_set',
    ]);
  });

  it('rejects another Device UUID, independent of physical identifiers', () => {
    const otherDevice = { ...smartDisplay, id: '76512cb7-7c2e-4182-ac36-e43733277440' };
    expect(() => resolveEffectiveActions(manifest(), otherDevice)).toThrow(EffectiveActionsIdentityError);
  });

  it('returns no actions for PENDING/unassigned or invalid Smart Display profiles', () => {
    expect(resolveEffectiveActions(manifest(), { ...smartDisplay, status: 'PENDING', roomId: null })).toEqual([]);
    expect(resolveEffectiveActions(manifest(), { ...smartDisplay, roomId: null })).toEqual([]);
    expect(resolveEffectiveActions(manifest(), { ...smartDisplay, semanticType: 'unknown' })).toEqual([]);
  });

  it('uses stable key order and emits only safe display fields', () => {
    const withPhysicalMetadata = {
      ...smartDisplay,
      ipAddress: '192.0.2.20',
      macAddress: '00:00:5e:00:53:01',
      androidId: 'physical-id',
      token: 'secret-never-emitted',
    };
    const first = resolveEffectiveActions(manifest(), withPhysicalMetadata);
    const reordered = manifest();
    reordered.actions.reverse();
    expect(resolveEffectiveActions(reordered, withPhysicalMetadata)).toEqual(first);
    expect(first[0]).toEqual({
      key: 'hp_navigate_back',
      displayName: 'hp_navigate_back',
      semanticAction: 'navigate_back',
      controlType: 'button',
      visibility: 'visible',
      safetyLevel: 'normal',
      requiresConfirmation: false,
    });
    const serialized = JSON.stringify(first);
    for (const value of ['192.0.2.20', '00:00:5e:00:53:01', 'physical-id', 'secret-never-emitted', 'implementationConfig']) {
      expect(serialized).not.toContain(value);
    }
  });

  it('retains visibility without treating it as a capability grant', () => {
    const input = manifest();
    input.actions[0].visibility = 'hidden';
    expect(resolveEffectiveActions(input, smartDisplay).find((entry) => entry.key === 'hp_volume_set')?.visibility).toBe('hidden');
    input.actions[0].semanticAction = 'turn_on';
    expect(resolveEffectiveActions(input, smartDisplay).find((entry) => entry.key === 'hp_volume_set')).toBeUndefined();
  });

  it('keeps the existing local volume schema: integer volume 0..100', () => {
    expect(validateDeviceCommand(smartDisplay, { name: 'volume_set', params: { volume: 0 } }).valid).toBe(true);
    expect(validateDeviceCommand(smartDisplay, { name: 'volume_set', params: { volume: 100 } }).valid).toBe(true);
    for (const invalid of [{ volume: -1 }, { volume: 101 }, { volume: 1.5 }, { level: 50 }]) {
      expect(validateDeviceCommand(smartDisplay, { name: 'volume_set', params: invalid }).valid).toBe(false);
    }
  });
});
