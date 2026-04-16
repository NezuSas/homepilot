import Redis from 'ioredis';
import { EventBus, EventBusEvent, EventBusHandler } from '../../domain/events/EventBus';

/**
 * Channel prefix used to namespace HomePilot events in Redis.
 * Avoids collisions with other applications sharing the same Redis instance.
 */
const CHANNEL_PREFIX = 'homepilot:';

/**
 * RedisEventBus
 *
 * Durable EventBus backed by Redis Pub/Sub.
 *
 * Design decisions:
 *  - Two ioredis connections are required: one dedicated to SUBSCRIBE mode and
 *    one for PUBLISH commands (Redis forbids mixing them on the same connection).
 *  - ioredis handles reconnect automatically. The subscriber re-subscribes to
 *    all channels on reconnect via autoResubscribe (default: true).
 *  - On publish failure (Redis down), the event is dispatched synchronously to
 *    local handlers as a fallback to prevent event loss within the process.
 *  - Handlers registered via subscribe() are called when the Redis subscriber
 *    receives a message; this correctly handles both in-process events AND
 *    events published from other processes in future multi-worker deployments.
 *
 * Durability note:
 *  - Redis Pub/Sub is NOT persistent storage (messages not delivered to offline
 *    subscribers are lost). For full persistence, upgrade to Redis Streams in a
 *    future iteration. The primary benefit here is cross-process propagation
 *    and graceful fallback over the pure in-memory implementation.
 */
export class RedisEventBus implements EventBus {
  private readonly pubClient: Redis;
  private readonly subClient: Redis;
  private readonly handlers = new Map<string, EventBusHandler[]>();
  private ready = false;

  constructor(redisUrl: string) {
    const sharedOptions = {
      retryStrategy: (times: number): number => Math.min(times * 200, 5000),
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 10_000,
    };

    this.pubClient = new Redis(redisUrl, {
      ...sharedOptions,
      maxRetriesPerRequest: 3,
    });

    this.subClient = new Redis(redisUrl, {
      ...sharedOptions,
      // autoResubscribe is true by default — ioredis re-subscribes after reconnect
      maxRetriesPerRequest: null,
    });

    this.pubClient.on('ready', () => {
      this.ready = true;
      console.log('[RedisEventBus] Publisher connected.');
    });

    this.pubClient.on('error', (err) => {
      console.error('[RedisEventBus] Publisher error:', err.message);
    });

    this.subClient.on('ready', () => {
      console.log('[RedisEventBus] Subscriber connected.');
    });

    this.subClient.on('error', (err) => {
      console.error('[RedisEventBus] Subscriber error:', err.message);
    });

    this.subClient.on('message', (channel: string, message: string) => {
      this.onRedisMessage(channel, message);
    });
  }

  /**
   * Publish an event to Redis. All subscribers in this process (and any other
   * process connected to the same Redis) will receive the message.
   *
   * Falls back to synchronous local dispatch if the Redis publish fails.
   */
  async publish(event: EventBusEvent): Promise<void> {
    const channel = `${CHANNEL_PREFIX}${event.eventType}`;
    const message = JSON.stringify(event);

    try {
      await this.pubClient.publish(channel, message);
    } catch (err) {
      // Redis unavailable — dispatch locally to prevent event loss within this process
      console.warn(
        '[RedisEventBus] publish failed, falling back to local dispatch:',
        err instanceof Error ? err.message : err
      );
      await this.dispatchLocally(event);
    }
  }

  /**
   * Register a handler for a given event type.
   * The first subscription for a given eventType also subscribes the
   * underlying Redis subscriber connection to that channel.
   *
   * Returns an unsubscriber function that removes this specific handler.
   * When the last handler for an eventType is removed, the Redis channel
   * subscription is cancelled.
   */
  subscribe(eventType: string, handler: EventBusHandler): () => void {
    const existing = this.handlers.get(eventType) ?? [];
    const isFirst = existing.length === 0;

    existing.push(handler);
    this.handlers.set(eventType, existing);

    if (isFirst) {
      const channel = `${CHANNEL_PREFIX}${eventType}`;
      this.subClient.subscribe(channel).catch((err) => {
        console.error(`[RedisEventBus] Failed to subscribe to channel ${channel}:`, err.message);
      });
    }

    return () => {
      const current = this.handlers.get(eventType) ?? [];
      const next = current.filter((h) => h !== handler);

      if (next.length === 0) {
        this.handlers.delete(eventType);
        const channel = `${CHANNEL_PREFIX}${eventType}`;
        this.subClient.unsubscribe(channel).catch((err) => {
          console.error(`[RedisEventBus] Failed to unsubscribe from ${channel}:`, err.message);
        });
      } else {
        this.handlers.set(eventType, next);
      }
    };
  }

  /**
   * Gracefully close both Redis connections.
   * Should be called during application shutdown.
   */
  async close(): Promise<void> {
    await Promise.allSettled([this.pubClient.quit(), this.subClient.quit()]);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private onRedisMessage(channel: string, message: string): void {
    const eventType = channel.startsWith(CHANNEL_PREFIX)
      ? channel.slice(CHANNEL_PREFIX.length)
      : channel;

    let event: EventBusEvent;
    try {
      event = JSON.parse(message) as EventBusEvent;
    } catch {
      console.error(`[RedisEventBus] Failed to parse message on channel ${channel}:`, message);
      return;
    }

    const handlers = this.handlers.get(eventType) ?? [];
    Promise.allSettled(handlers.map((h) => h(event))).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[RedisEventBus] Handler failed:', result.reason);
        }
      }
    });
  }

  private async dispatchLocally(event: EventBusEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    const results = await Promise.allSettled(handlers.map((h) => h(event)));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[RedisEventBus] Local fallback handler failed:', result.reason);
      }
    }
  }
}
