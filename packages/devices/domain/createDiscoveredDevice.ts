import { Device } from './types';
import { 
  InvalidDeviceExternalIdError, 
  InvalidTopologyReferenceError,
  InvalidDeviceNameError,
  InvalidDeviceTypeError,
  InvalidDeviceVendorError
} from './errors';
import { IdGenerator, Clock } from '../../shared/domain/types';

export interface CreateDiscoveredDevicePayload {
  homeId: string;
  externalId: string;
  name: string;
  type: string;
  vendor: string;
  integrationSource?: string;
}

export interface CreateDiscoveredDeviceDependencies {
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Factoría pura para inicializar un dispositivo recién descubierto en el Inbox.
 * Validación estricta acatando explícitamente el spec funcional. 
 * Sin inventar defaults para atributos core previniendo data inconsistente desde integradores.
 */
export function createDiscoveredDevice(
  payload: CreateDiscoveredDevicePayload,
  dependencies: CreateDiscoveredDeviceDependencies
): Device {
  if (!payload.homeId || typeof payload.homeId !== 'string' || payload.homeId.trim() === '') {
    throw new InvalidTopologyReferenceError('homeId');
  }

  if (!payload.externalId || typeof payload.externalId !== 'string' || payload.externalId.trim() === '') {
    throw new InvalidDeviceExternalIdError();
  }

  // Validación estricta dictada por el spec: sin suposiciones de valores base.
  if (!payload.name || typeof payload.name !== 'string' || payload.name.trim() === '') {
    throw new InvalidDeviceNameError();
  }

  if (!payload.type || typeof payload.type !== 'string' || payload.type.trim() === '') {
    throw new InvalidDeviceTypeError();
  }

  if (!payload.vendor || typeof payload.vendor !== 'string' || payload.vendor.trim() === '') {
    throw new InvalidDeviceVendorError();
  }

  const now = dependencies.clock.now();

  const device: Device = {
    id: dependencies.idGenerator.generate(),
    homeId: payload.homeId.trim(),
    roomId: null, // PENDING context implicitly dictando etapa 'Inbox'
    externalId: payload.externalId.trim(),
    name: payload.name.trim(),
    type: payload.type.trim(),
    vendor: payload.vendor.trim(),
    status: 'PENDING',
    integrationSource: payload.integrationSource?.trim() || 'ha',
    invertState: false,
    lastKnownState: null,
    entityVersion: 1,
    createdAt: now,
    updatedAt: now
  };

  return Object.freeze(device);
}
