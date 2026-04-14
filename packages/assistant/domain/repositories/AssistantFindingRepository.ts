import { AssistantFinding, FindingStatus, FindingType } from './AssistantFinding';

export interface AssistantFindingRepository {
  save(finding: AssistantFinding): Promise<void>;
  findById(id: string): Promise<AssistantFinding | null>;
  findByFingerprint(fingerprint: string): Promise<AssistantFinding | null>;
  findAllOpen(): Promise<AssistantFinding[]>;
  findAllByStatus(status: FindingStatus): Promise<AssistantFinding[]>;
  updateStatus(id: string, status: FindingStatus): Promise<void>;
  /** Bulk update status for findings that are no longer detected */
  resolveMissing(currentFingerprints: string[]): Promise<number>;
  getSummary(): Promise<{ totalOpen: number; bySeverity: Record<string, number>; byType: Record<string, number> }>;
}
