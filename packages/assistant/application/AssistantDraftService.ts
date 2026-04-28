import { AssistantDraft } from '../domain/AssistantDraft';
import { AssistantDraftRepository } from '../domain/repositories/AssistantDraftRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { Scene, SceneAction } from '../../devices/domain/Scene';
import { AutomationRule, AutomationTrigger, AutomationAction } from '../../devices/domain/automation/types';
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
      const rule: AutomationRule = {
        id: this.idGenerator.generate(),
        homeId: p['homeId'] as string,
        userId,
        name: p['name'] as string,
        enabled: true,
        trigger: p['trigger'] as AutomationTrigger,
        action: p['action'] as AutomationAction
      };
      await this.automationRepository.save(rule);
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
        deviceId: m.deviceId,
        command: 'turn_on' as const,
        params: {}
      };
      await this.createAutomationDraft(homeId, 'Suggested Automation', m.trigger, action, fingerprint);
    }
  }
}
