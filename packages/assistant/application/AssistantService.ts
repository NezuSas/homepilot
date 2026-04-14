import { randomUUID } from 'crypto';
import { AssistantFindingRepository } from '../domain/repositories/AssistantFindingRepository';
import { AssistantDetectionService } from './AssistantDetectionService';
import { AssistantFinding } from '../domain/AssistantFinding';

export class AssistantService {
  private isScanning = false;

  constructor(
    private readonly repository: AssistantFindingRepository,
    private readonly detectionService: AssistantDetectionService
  ) {}

  public async scan(homeId: string, source: string = 'system_scan'): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const detected = await this.detectionService.scan(homeId);
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
    const cooldownDays = 7;
    const dismissedUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    await this.repository.updateStatus(id, 'dismissed', dismissedUntil);
  }

  public async resolve(id: string): Promise<void> {
    await this.repository.updateStatus(id, 'resolved');
  }
}
