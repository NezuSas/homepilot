export interface AssistantMemoryRecord {
  userId: string;
  key: string;
  value: string;
  valueType: 'string' | 'json' | 'number';
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMemoryRepository {
  upsert(record: Omit<AssistantMemoryRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  findByKey(userId: string, key: string): Promise<AssistantMemoryRecord | null>;
  listByPrefix(userId: string, prefix: string): Promise<AssistantMemoryRecord[]>;
  delete(userId: string, key: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
