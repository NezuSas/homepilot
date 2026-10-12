import type { ActivityLogRepository, ActivityType } from '../../devices/domain/repositories/ActivityLogRepository';

/** Operational noise worth a few days of history; everything else is audit trail kept much longer. */
export const NOISE_ACTIVITY_TYPES: readonly ActivityType[] = ['STATE_CHANGED', 'AUTOMATION_EXECUTED'];

export const DEFAULT_NOISE_RETENTION_DAYS = 7;
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivityRetentionPolicy {
  readonly noiseDays: number;
  readonly auditDays: number;
}

/** Reads the retention days from the environment; anything that is not a positive whole number uses the default. */
export function readRetentionPolicy(env: Record<string, string | undefined> = process.env): ActivityRetentionPolicy {
  const days = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    noiseDays: days(env.HOMEPILOT_ACTIVITY_NOISE_RETENTION_DAYS, DEFAULT_NOISE_RETENTION_DAYS),
    auditDays: days(env.HOMEPILOT_ACTIVITY_RETENTION_DAYS, DEFAULT_AUDIT_RETENTION_DAYS),
  };
}

export interface ActivityRetentionRunResult {
  readonly noiseDeleted: number;
  readonly auditDeleted: number;
}

interface ActivityLogRetentionOptions {
  readonly policy?: ActivityRetentionPolicy;
  readonly batchSize?: number;
  readonly now?: () => number;
  /** Lets the process serve requests between batches of a large first cleanup. */
  readonly yieldToEventLoop?: () => Promise<void>;
  readonly onError?: (error: unknown) => void;
}

/**
 * Keeps the activity log from growing without limit. Deletes old rows in small batches (the database is
 * synchronous, so a single huge delete would freeze the API) and repeats every few hours.
 */
export class ActivityLogRetentionService {
  private readonly policy: ActivityRetentionPolicy;
  private readonly batchSize: number;
  private readonly now: () => number;
  private readonly yieldToEventLoop: () => Promise<void>;
  private readonly onError: (error: unknown) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = true;

  constructor(private readonly repository: ActivityLogRepository, options: ActivityLogRetentionOptions = {}) {
    this.policy = options.policy ?? readRetentionPolicy();
    this.batchSize = Math.max(1, Math.floor(options.batchSize ?? 5000));
    this.now = options.now ?? Date.now;
    this.yieldToEventLoop = options.yieldToEventLoop ?? (() => new Promise<void>((resolve) => setImmediate(resolve)));
    this.onError = options.onError ?? (() => undefined);
  }

  /** One full pass: noise older than its retention period, then anything else older than the audit retention period. */
  public async runOnce(): Promise<ActivityRetentionRunResult> {
    const noiseCutoff = new Date(this.now() - this.policy.noiseDays * DAY_MS).toISOString();
    const auditCutoff = new Date(this.now() - this.policy.auditDays * DAY_MS).toISOString();
    const noiseDeleted = await this.deleteInBatches(noiseCutoff, { types: NOISE_ACTIVITY_TYPES });
    const auditDeleted = await this.deleteInBatches(auditCutoff, { excludeTypes: NOISE_ACTIVITY_TYPES });
    return { noiseDeleted, auditDeleted };
  }

  /** Runs soon after start and then every `intervalMs`; a failed pass is reported and tried again later. */
  public start(intervalMs: number = 6 * 60 * 60 * 1000, initialDelayMs: number = 60_000): void {
    if (!this.stopped) return;
    this.stopped = false;
    const schedule = (delay: number) => {
      this.timer = setTimeout(async () => {
        this.timer = null;
        if (this.running) return schedule(intervalMs);
        this.running = true;
        try {
          await this.runOnce();
        } catch (error: unknown) {
          this.onError(error);
        } finally {
          this.running = false;
          if (!this.stopped) schedule(intervalMs);
        }
      }, delay);
      this.timer.unref?.();
    };
    schedule(initialDelayMs);
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async deleteInBatches(cutoff: string, scope: { types?: readonly ActivityType[]; excludeTypes?: readonly ActivityType[] }): Promise<number> {
    let total = 0;
    for (;;) {
      const deleted = await this.repository.deleteOlderThan(cutoff, { ...scope, limit: this.batchSize });
      total += deleted;
      if (deleted < this.batchSize) return total;
      await this.yieldToEventLoop();
    }
  }
}
