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
            title: this.generateFallbackTitle(partial),
            description: this.generateFallbackDescription(partial),
            relatedEntityType: partial.relatedEntityType || null,
            relatedEntityId: partial.relatedEntityId || null,
            status: 'open',
            actions: partial.actions || [],
            metadata: partial.metadata || {},
            createdAt: now,
            updatedAt: now
          };
          await this.repository.save(finding);
        } else if (existing.status === 'open') {
          // UPDATE EXISTING OPEN (Metadata and actions might have changed)
          await this.repository.save({
            ...existing,
            actions: partial.actions || [],
            metadata: { ...existing.metadata, ...partial.metadata },
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
    await this.repository.updateStatus(id, 'dismissed');
  }

  public async resolve(id: string): Promise<void> {
    await this.repository.updateStatus(id, 'resolved');
  }

  private generateFallbackTitle(f: Partial<AssistantFinding>): string {
    switch (f.type) {
      case 'new_device_available': return 'New device detected';
      case 'device_missing_room': return 'Device missing room';
      case 'device_name_technical': return 'Technical name detected';
      case 'device_name_duplicate': return 'Duplicate names found';
      default: return 'System suggestion';
    }
  }

  private generateFallbackDescription(f: Partial<AssistantFinding>): string {
    switch (f.type) {
      case 'new_device_available': return `A new entity "${f.metadata?.friendlyName}" is available in Home Assistant.`;
      case 'device_missing_room': return `Device "${f.metadata?.deviceName}" needs to be assigned to a room.`;
      case 'device_name_technical': return `The name "${f.metadata?.currentName}" looks like a technical ID.`;
      case 'device_name_duplicate': return `Multiple devices share the name "${f.metadata?.name}".`;
      default: return 'Follow the recommended action to improve your system.';
    }
  }
}
