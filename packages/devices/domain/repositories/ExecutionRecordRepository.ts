import { ExecutionRecord } from '../ExecutionRecord';

export interface ExecutionRecordRepository {
  save(record: ExecutionRecord): Promise<void>;
  findRecent(limit?: number): Promise<ReadonlyArray<ExecutionRecord>>;
  findBySource(
    sourceType: 'scene' | 'automation' | 'manual',
    sourceId: string,
    limit?: number
  ): Promise<ReadonlyArray<ExecutionRecord>>;
}
