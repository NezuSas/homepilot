import { randomUUID } from 'crypto';
import { AssistantFindingRepository } from '../domain/repositories/AssistantFindingRepository';
import { AssistantDetectionService } from './AssistantDetectionService';
import { AssistantFinding } from '../domain/AssistantFinding';
import { AssistantLearningService } from './AssistantLearningService';
import { AssistantFeedbackRepository } from '../domain/repositories/AssistantFeedbackRepository';
import { AssistantFeedbackEvent } from '../domain/AssistantFeedbackEvent';
import { AssistantIntentService } from './AssistantIntentService';
import { AssistantDraftProposal } from '../domain/AssistantIntent';

export class AssistantService {
  private isScanning = false;

  constructor(
    private readonly repository: AssistantFindingRepository,
    private readonly detectionService: AssistantDetectionService,
    private readonly learningService: AssistantLearningService,
    private readonly feedbackRepository: AssistantFeedbackRepository,
    private readonly intentService: AssistantIntentService
  ) {}

  public async scan(homeId: string, source: string = 'system_scan'): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const learning = await this.learningService.computeModifiers();
      const detected = await this.detectionService.scan(homeId, learning);
      const now = new Date().toISOString();
      const detectedFingerprints = detected.map(f => f.fingerprint!);

      // 1. Resolve findings that are no longer detected
      await this.repository.resolveMissing(detectedFingerprints);

      // 2. Process detected findings
      for (const partial of detected) {
        const existing = await this.repository.findByFingerprint(partial.fingerprint!);

        if (!existing) {
          // CREATE NEW
          const finding: AssistantFinding = {
            id: randomUUID(),
            fingerprint: partial.fingerprint!,
            source,
            type: partial.type!,
            severity: partial.severity!,
            title: `assistant.types.${partial.type!}`, // Semantic reference
            description: `assistant.types.${partial.type!}_description`, // Semantic reference
            relatedEntityType: partial.relatedEntityType || null,
            relatedEntityId: partial.relatedEntityId || null,
            status: 'open',
            actions: partial.actions || [],
            metadata: partial.metadata || {},
            score: partial.score || 0,
            createdAt: now,
            updatedAt: now
          };
          await this.repository.save(finding);
        } else if (existing.status === 'open') {
          // UPDATE EXISTING OPEN (Metadata, actions, and score might have changed)
          await this.repository.save({
            ...existing,
            actions: partial.actions || [],
            metadata: { ...existing.metadata, ...partial.metadata },
            score: partial.score || existing.score,
            explanation: partial.explanation || existing.explanation,
            updatedAt: now
          });
        }
        // If status is 'dismissed', we do nothing (persistent dismissal)
      }
    } finally {
      this.isScanning = false;
    }
  }

  public async listOpen(): Promise<AssistantFinding[]> {
    return this.repository.findAllOpen();
  }

  public async getSummary() {
    return this.repository.getSummary();
  }

  public async dismiss(id: string): Promise<void> {
    const finding = await this.repository.findById(id);
    if (finding) {
      await this.recordFeedback(finding, 'dismissed');
    }
    const cooldownDays = 7;
    const dismissedUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    await this.repository.updateStatus(id, 'dismissed', dismissedUntil);
  }

  public async resolve(id: string): Promise<void> {
    const finding = await this.repository.findById(id);
    if (finding) {
      await this.recordFeedback(finding, 'completed');
    }
    await this.repository.updateStatus(id, 'resolved');
  }

  private async recordFeedback(finding: AssistantFinding, type: any): Promise<void> {
    const event: AssistantFeedbackEvent = {
      id: randomUUID(),
      findingType: finding.type,
      relatedEntityType: finding.relatedEntityType,
      relatedEntityId: finding.relatedEntityId,
      roomId: finding.metadata?.roomId || null,
      domain: finding.metadata?.domain || null,
      actionType: null, // Could be refined if we track specific action clicked
      feedbackType: type,
      createdAt: new Date().toISOString(),
      metadata: {}
    };
    await this.feedbackRepository.save(event);
  }

  public async interpret(input: string): Promise<AssistantDraftProposal> {
    const intent = await this.intentService.parse(input);
    return this.intentService.generateProposal(intent);
  }
}
