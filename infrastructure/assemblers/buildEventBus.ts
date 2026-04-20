/**
 * buildEventBus.ts
 *
 * Assembler: construcción del EventBus y los publishers de dominio.
 * Selecciona Redis si REDIS_URL está configurado, InMemory como fallback.
 */
import { InMemoryEventBus } from '../../packages/shared/infrastructure/events/InMemoryEventBus';
import { RedisEventBus } from '../../packages/shared/infrastructure/events/RedisEventBus';
import { EventBusDeviceEventPublisher } from '../../packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import { EventBusTopologyEventPublisher } from '../../packages/topology/infrastructure/adapters/EventBusTopologyEventPublisher';
import type { EventBus } from '../../packages/shared/domain/events/EventBus';

export interface EventBusAssembly {
  eventBus: EventBus;
  deviceEventPublisher: EventBusDeviceEventPublisher;
  topologyEventPublisher: EventBusTopologyEventPublisher;
}

export function buildEventBus(): EventBusAssembly {
  const redisUrl = process.env.REDIS_URL;
  const eventBus: EventBus = redisUrl
    ? new RedisEventBus(redisUrl)
    : new InMemoryEventBus();

  if (redisUrl) {
    console.log(`[Bootstrap] EventBus: Redis Pub/Sub (${redisUrl})`);
  } else {
    console.log('[Bootstrap] EventBus: InMemory (set REDIS_URL to enable Redis)');
  }

  const deviceEventPublisher = new EventBusDeviceEventPublisher(eventBus);
  const topologyEventPublisher = new EventBusTopologyEventPublisher(eventBus);

  return { eventBus, deviceEventPublisher, topologyEventPublisher };
}
