import { AssistantDraft } from '../domain/AssistantDraft';
import { AssistantDraftRepository } from '../domain/repositories/AssistantDraftRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { Scene, SceneAction } from '../../devices/domain/Scene';
import { AutomationRule, AutomationTrigger, AutomationAction } from '../../devices/domain/automation/types';
import { IdGenerator } from '../../shared/domain/types';

export class AssistantDraftService {
  constructor(
    private readonly draftRepository: AssistantDraftRepository,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly idGenerator: IdGenerator
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
}
