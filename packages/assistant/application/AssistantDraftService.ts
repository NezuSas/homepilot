import { randomUUID } from 'crypto';
import { AssistantDraft, AssistantDraftType } from '../domain/AssistantDraft';
import { AssistantDraftRepository } from '../domain/repositories/AssistantDraftRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { IdGenerator } from '../../shared/domain/types';

export class AssistantDraftService {
  constructor(
    private readonly draftRepository: AssistantDraftRepository,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly idGenerator: IdGenerator
  ) {}

  public async createAutomationDraft(homeId: string, name: string, trigger: any, action: any): Promise<AssistantDraft> {
    const draft: AssistantDraft = {
      id: randomUUID(),
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

  public async createSceneDraft(homeId: string, roomId: string | null, name: string, actions: any[]): Promise<AssistantDraft> {
    const draft: AssistantDraft = {
      id: randomUUID(),
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
      const rule = {
        ...draft.payload,
        id: this.idGenerator.generate(),
        userId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.automationRepository.save(rule);
    } else if (draft.type === 'scene') {
      const scene = {
        ...draft.payload,
        id: this.idGenerator.generate(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.sceneRepository.saveScene(scene);
    }

    await this.draftRepository.updateStatus(draftId, 'active');
  }
}
