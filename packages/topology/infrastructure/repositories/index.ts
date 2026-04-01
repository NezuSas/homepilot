/**
 * Exportaciones concretas para los Adaptadores de Persistencia (SQLite e InMemory).
 */

// InMemory (Legacy/Tests)
export * from './InMemoryHomeRepository';
export * from './InMemoryRoomRepository';

// SQLite (Durable Persistence V1)
export * from './SQLiteHomeRepository';
export * from './SQLiteRoomRepository';
