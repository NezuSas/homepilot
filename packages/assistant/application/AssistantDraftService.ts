import { AssistantDraft } from '../domain/AssistantDraft';
import { AssistantDraftRepository } from '../domain/repositories/AssistantDraftRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { Scene, SceneAction } from '../../devices/domain/Scene';
import { AutomationAction, AutomationTrigger, TimeTrigger } from '../../devices/domain/automation/types';
import { createAutomationRule } from '../../devices/domain/automation/createAutomationRule';
import { isValidCommand } from '../../devices/domain/commands';
import { IdGenerator } from '../../shared/domain/types';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';

export type SceneSuggestionMetadata = {
  homeId: string;
  roomId?: string;
  deviceIds: string[];
};

export type AutomationSuggestionMetadata = {
  homeId: string;
  deviceId: string;
  trigger: unknown;
  hour?: string;
};

export type ScheduledRoutineTrigger = Pick<TimeTrigger, 'type' | 'timeLocal' | 'timezone' | 'days' | 'dateLocal'>;

type ScheduledRoutineDraftPayload = {
  homeId: string;
  name: string;
  roomId: string | null;
  trigger: ScheduledRoutineTrigger;
  actions: SceneAction[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSceneAction(value: unknown): value is SceneAction {
  if (!isRecord(value) || typeof value.deviceId !== 'string') return false;
  if (typeof value.command === 'string') return isValidCommand(value.command);
  return isRecord(value.command) && typeof value.command.name === 'string' && isValidCommand(value.command.name);
}

function isScheduledRoutineDraftPayload(value: Record<string, unknown>): value is ScheduledRoutineDraftPayload {
  const trigger = value.trigger;
  return typeof value.homeId === 'string'
    && typeof value.name === 'string'
    && (typeof value.roomId === 'string' || value.roomId === null)
    && isRecord(trigger)
    && trigger.type === 'time'
    && typeof trigger.timeLocal === 'string'
    && typeof trigger.timezone === 'string'
    && (trigger.dateLocal === undefined || typeof trigger.dateLocal === 'string')
    && (trigger.days === undefined || (Array.isArray(trigger.days) && trigger.days.every(day => typeof day === 'number')))
    && Array.isArray(value.actions)
    && value.actions.every(isSceneAction);
}

function isAutomationTrigger(value: unknown): value is AutomationTrigger {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'time') return typeof value.timeLocal === 'string' && typeof value.timezone === 'string' && typeof value.timeUTC === 'string' && (value.dateLocal === undefined || typeof value.dateLocal === 'string');
  if (value.type === 'device_state_changed') {
    return typeof value.deviceId === 'string'
      && typeof value.stateKey === 'string'
      && (typeof value.expectedValue === 'string' || typeof value.expectedValue === 'number' || typeof value.expectedValue === 'boolean');
  }
  return value.type === 'compound'
    && (value.operator === 'AND' || value.operator === 'OR' || value.operator === 'NOT')
    && Array.isArray(value.conditions)
    && value.conditions.every(isAutomationTrigger);
}

function isAutomationAction(value: unknown): value is AutomationAction {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'device_command') return typeof value.targetDeviceId === 'string' && typeof value.command === 'string' && isValidCommand(value.command);
  if (value.type === 'execute_scene') return typeof value.sceneId === 'string';
  return value.type === 'delay'
    && typeof value.delaySeconds === 'number'
    && (isAutomationAction(value.then) && value.then.type !== 'delay');
}

export class AssistantDraftService {
  constructor(
    private readonly draftRepository: AssistantDraftRepository,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly idGenerator: IdGenerator,
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository
  ) {}

  public async createAutomationDraft(homeId: string, name: string, trigger: unknown, action: unknown, fingerprint: string): Promise<AssistantDraft> {
    const existing = await this.draftRepository.findByFingerprint(fingerprint);
    if (existing) return existing;

    const draft: AssistantDraft = {
      id: this.idGenerator.generate(),
      fingerprint,
      type: 'automation',
      status: 'draft',
      payload: {
        homeId,
        name,
        trigger,
        action
      },
      createdAt: new Date().toISOString()
    };
    await this.draftRepository.save(draft);
    return draft;
  }

  public async createScheduledRoutineDraft(
    homeId: string,
    roomId: string | null,
    name: string,
    trigger: ScheduledRoutineTrigger,
    actions: SceneAction[],
    fingerprint: string
  ): Promise<AssistantDraft> {
    const existing = await this.draftRepository.findByFingerprint(fingerprint);
    if (existing) return existing;

    const draft: AssistantDraft = {
      id: this.idGenerator.generate(),
      fingerprint,
      type: 'automation',
      status: 'draft',
      payload: { homeId, roomId, name, trigger, actions },
      createdAt: new Date().toISOString()
    };
    await this.draftRepository.save(draft);
    return draft;
  }

  public async createSceneDraft(homeId: string, roomId: string | null, name: string, actions: unknown[], fingerprint: string): Promise<AssistantDraft> {
    const existing = await this.draftRepository.findByFingerprint(fingerprint);
    if (existing) return existing;

    const draft: AssistantDraft = {
      id: this.idGenerator.generate(),
      fingerprint,
      type: 'scene',
      status: 'draft',
      payload: {
        homeId,
        roomId,
        name,
        actions
      },
      createdAt: new Date().toISOString()
    };
    await this.draftRepository.save(draft);
    return draft;
  }

  public async activateDraft(draftId: string, userId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new Error('DRAFT_NOT_FOUND');
    if (draft.status === 'active') return;

    if (draft.type === 'automation') {
      const p = draft.payload;
      if (isScheduledRoutineDraftPayload(p)) {
        const sceneId = this.idGenerator.generate();
        const rule = createAutomationRule({
          homeId: p.homeId,
          userId,
          name: p.name,
          trigger: { ...p.trigger, timeUTC: '' },
          action: { type: 'execute_scene', sceneId }
        }, this.idGenerator);
        const now = new Date().toISOString();
        const scene: Scene = {
          id: sceneId,
          homeId: p.homeId,
          roomId: p.roomId,
          name: p.name,
          actions: p.actions,
          executionMode: 'parallel',
          createdAt: now,
          updatedAt: now
        };
        await this.sceneRepository.saveScene(scene);
        await this.automationRepository.save(rule);
      } else if (typeof p.homeId === 'string' && typeof p.name === 'string' && isAutomationTrigger(p.trigger) && isAutomationAction(p.action)) {
        const rule = createAutomationRule({
          homeId: p.homeId,
          userId,
          name: p.name,
          trigger: p.trigger,
          action: p.action
        }, this.idGenerator);
        await this.automationRepository.save(rule);
      } else {
        throw new Error('INVALID_AUTOMATION_DRAFT');
      }
    } else if (draft.type === 'scene') {
      const p = draft.payload;
      const now = new Date().toISOString();
      const scene: Scene = {
        id: this.idGenerator.generate(),
        homeId: p['homeId'] as string,
        roomId: (p['roomId'] as string | undefined) || null,
        name: p['name'] as string,
        actions: p['actions'] as SceneAction[],
        createdAt: now,
        updatedAt: now
      };
      await this.sceneRepository.saveScene(scene);
    }

    await this.draftRepository.updateStatus(draftId, 'active');
  }

  public async createDraft(
    userId: string,
    type: 'scene' | 'automation',
    metadata: SceneSuggestionMetadata | AutomationSuggestionMetadata
  ): Promise<void> {
    if (!metadata.homeId || typeof metadata.homeId !== 'string') {
      throw new Error('MISSING_HOME_ID_FOR_SUGGESTION_DRAFT');
    }

    const homeId = metadata.homeId;
    let fingerprint = '';

    if (type === 'scene') {
      const m = metadata as SceneSuggestionMetadata;
      if (!Array.isArray(m.deviceIds) || m.deviceIds.some(id => typeof id !== 'string')) {
        throw new Error('INVALID_SUGGESTION_METADATA: deviceIds must be string[]');
      }

      // Validate entity existence
      const devices = await Promise.all(m.deviceIds.map(id => this.deviceRepository.findDeviceById(id)));
      if (devices.some(d => !d)) {
        throw new Error('INVALID_SUGGESTION_METADATA: One or more devices do not exist');
      }

      if (m.roomId) {
        const room = await this.roomRepository.findRoomById(m.roomId);
        if (!room || room.homeId !== homeId) {
          throw new Error('INVALID_SUGGESTION_METADATA: Room does not exist or belongs to different home');
        }
      }

      const sortedDeviceIds = [...m.deviceIds].sort();
      fingerprint = [
        'suggestion',
        type,
        userId,
        homeId,
        m.roomId || '',
        sortedDeviceIds.join(','),
        ''
      ].join(':');

      const actions = m.deviceIds.map(id => ({
        deviceId: id,
        command: 'turn_on' as const,
        params: {}
      }));
      await this.createSceneDraft(homeId, m.roomId || null, 'Suggested Scene', actions, fingerprint);
    } else if (type === 'automation') {
      const m = metadata as AutomationSuggestionMetadata;
      if (!m.deviceId || typeof m.deviceId !== 'string') {
        throw new Error('INVALID_SUGGESTION_METADATA: deviceId must be string');
      }

      // Validate entity existence
      const device = await this.deviceRepository.findDeviceById(m.deviceId);
      if (!device) {
        throw new Error('INVALID_SUGGESTION_METADATA: Device does not exist');
      }

      fingerprint = [
        'suggestion',
        type,
        userId,
        homeId,
        '',
        m.deviceId,
        m.hour || ''
      ].join(':');

      const action = {
        type: 'device_command' as const,
        targetDeviceId: m.deviceId,
        command: 'turn_on' as const
      };
      await this.createAutomationDraft(homeId, 'Suggested Automation', m.trigger, action, fingerprint);
    }
  }
}
