import { ExecutionRecord, SceneActionResult } from '../../domain/ExecutionRecord';
import { ExecutionRecordRepository } from '../../domain/repositories/ExecutionRecordRepository';

export class InMemoryExecutionRecordRepository implements ExecutionRecordRepository {
  private records: ExecutionRecord[] = [];

  public async save(record: ExecutionRecord): Promise<void> {
    this.records.push(Object.freeze({ ...record, actions: [...record.actions] }));
  }

  public async findRecent(limit: number = 50): Promise<ReadonlyArray<ExecutionRecord>> {
    return [...this.records]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  public async findBySource(
    sourceType: 'scene' | 'automation' | 'manual',
    sourceId: string,
    limit: number = 50
  ): Promise<ReadonlyArray<ExecutionRecord>> {
    return this.records
      .filter(r => r.sourceType === sourceType && r.sourceId === sourceId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }
}
