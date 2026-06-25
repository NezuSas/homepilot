import { CapabilityType, CAPABILITY_DEFINITIONS, DeviceCapability } from './capabilities';
import { DeviceCommandV1 } from './commands';
import { Device, DeviceSemanticType } from './types';

export type DeviceProfileSource = 'home_assistant' | 'generic';
export type DeviceProfileCategory = 'lighting' | 'switching' | 'covering' | 'sensing' | 'climate' | 'media' | 'unknown';

export interface DeviceConfigurationSection {
  readonly id: 'assignment' | 'semantic' | 'cover_behavior' | 'state_sync' | 'read_only';
  readonly label: string;
  readonly description: string;
}

export interface DeviceProfile {
  readonly source: DeviceProfileSource;
  readonly domain: string;
  readonly type: CapabilityType | 'unknown';
  readonly semanticType?: DeviceSemanticType;
  readonly displayName: string;
  readonly category: DeviceProfileCategory;
  readonly capabilityTypes: ReadonlyArray<CapabilityType>;
  readonly supportedCommands: ReadonlyArray<DeviceCommandV1>;
  readonly configurationSections: ReadonlyArray<DeviceConfigurationSection>;
}

const ASSIGNMENT_SECTION: DeviceConfigurationSection = {
  id: 'assignment',
  label: 'Habitación',
  description: 'Permite ubicar el dispositivo dentro de una habitación del hogar.',
};

const SEMANTIC_SECTION: DeviceConfigurationSection = {
  id: 'semantic',
  label: 'Clasificación semántica',
  description: 'Permite ajustar cómo el asistente entiende este dispositivo sin cambiar el hardware.',
};

const COVER_BEHAVIOR_SECTION: DeviceConfigurationSection = {
  id: 'cover_behavior',
  label: 'Comportamiento de cortina',
  description: 'Permite invertir apertura/cierre cuando la integración reporta el estado físico al revés.',
};

const STATE_SYNC_SECTION: DeviceConfigurationSection = {
  id: 'state_sync',
  label: 'Sincronización',
  description: 'Permite refrescar el estado desde la integración externa cuando exista drift.',
};

const READ_ONLY_SECTION: DeviceConfigurationSection = {
  id: 'read_only',
  label: 'Solo lectura',
  description: 'Este perfil no expone comandos operativos desde HomePilot.',
};

function commandsFor(capabilityTypes: ReadonlyArray<CapabilityType>): ReadonlyArray<DeviceCommandV1> {
  return Array.from(new Set(capabilityTypes.flatMap((type) => CAPABILITY_DEFINITIONS[type].map((command) => command.name))));
}

function createProfile(profile: Omit<DeviceProfile, 'supportedCommands'>): DeviceProfile {
  return {
    ...profile,
    supportedCommands: commandsFor(profile.capabilityTypes),
  };
}

const HOME_ASSISTANT_DEVICE_PROFILES: Record<string, DeviceProfile> = {
  light: createProfile({
    source: 'home_assistant',
    domain: 'light',
    type: 'light',
    semanticType: 'light',
    displayName: 'Luz inteligente',
    category: 'lighting',
    capabilityTypes: ['light'],
    configurationSections: [ASSIGNMENT_SECTION, SEMANTIC_SECTION, STATE_SYNC_SECTION],
  }),
  switch: createProfile({
    source: 'home_assistant',
    domain: 'switch',
    type: 'switch',
    displayName: 'Interruptor inteligente',
    category: 'switching',
    capabilityTypes: ['switch'],
    configurationSections: [ASSIGNMENT_SECTION, SEMANTIC_SECTION, STATE_SYNC_SECTION],
  }),
  cover: createProfile({
    source: 'home_assistant',
    domain: 'cover',
    type: 'cover',
    semanticType: 'cover',
    displayName: 'Cortina o persiana inteligente',
    category: 'covering',
    capabilityTypes: ['cover'],
    configurationSections: [ASSIGNMENT_SECTION, COVER_BEHAVIOR_SECTION, STATE_SYNC_SECTION],
  }),
  sensor: createProfile({
    source: 'home_assistant',
    domain: 'sensor',
    type: 'sensor',
    semanticType: 'sensor',
    displayName: 'Sensor',
    category: 'sensing',
    capabilityTypes: ['sensor'],
    configurationSections: [ASSIGNMENT_SECTION, READ_ONLY_SECTION, STATE_SYNC_SECTION],
  }),
  binary_sensor: createProfile({
    source: 'home_assistant',
    domain: 'binary_sensor',
    type: 'binary_sensor',
    semanticType: 'sensor',
    displayName: 'Sensor binario',
    category: 'sensing',
    capabilityTypes: ['binary_sensor'],
    configurationSections: [ASSIGNMENT_SECTION, READ_ONLY_SECTION, STATE_SYNC_SECTION],
  }),
  climate: createProfile({
    source: 'home_assistant',
    domain: 'climate',
    type: 'climate',
    displayName: 'Climatización',
    category: 'climate',
    capabilityTypes: ['climate'],
    configurationSections: [ASSIGNMENT_SECTION, READ_ONLY_SECTION, STATE_SYNC_SECTION],
  }),
  media_player: createProfile({
    source: 'home_assistant',
    domain: 'media_player',
    type: 'media_player',
    displayName: 'Reproductor multimedia',
    category: 'media',
    capabilityTypes: ['media_player'],
    configurationSections: [ASSIGNMENT_SECTION, READ_ONLY_SECTION, STATE_SYNC_SECTION],
  }),
};

function createUnknownProfile(source: DeviceProfileSource, domain: string): DeviceProfile {
  return {
    source,
    domain,
    type: 'unknown',
    semanticType: 'unknown',
    displayName: 'Dispositivo no clasificado',
    category: 'unknown',
    capabilityTypes: [],
    supportedCommands: [],
    configurationSections: [ASSIGNMENT_SECTION, SEMANTIC_SECTION, READ_ONLY_SECTION],
  };
}

export function normalizeHomeAssistantDomain(entityIdOrDomain: string): string {
  const withoutPrefix = entityIdOrDomain.startsWith('ha:') ? entityIdOrDomain.slice(3) : entityIdOrDomain;
  return withoutPrefix.split('.')[0].trim().toLowerCase();
}

export function getHomeAssistantDeviceProfile(entityIdOrDomain: string): DeviceProfile {
  const domain = normalizeHomeAssistantDomain(entityIdOrDomain);
  return HOME_ASSISTANT_DEVICE_PROFILES[domain] || createUnknownProfile('home_assistant', domain);
}

export function listSupportedHomeAssistantDomains(): ReadonlyArray<string> {
  return Object.keys(HOME_ASSISTANT_DEVICE_PROFILES);
}

export function getDeviceProfileForDevice(device: Device): DeviceProfile {
  if (device.externalId.startsWith('ha:')) {
    return getHomeAssistantDeviceProfile(device.externalId);
  }

  const type = device.type.trim().toLowerCase();
  if (type in CAPABILITY_DEFINITIONS) {
    return createProfile({
      source: 'generic',
      domain: type,
      type: type as CapabilityType,
      semanticType: device.semanticType || undefined,
      displayName: device.type,
      category: 'unknown',
      capabilityTypes: [type as CapabilityType],
      configurationSections: [ASSIGNMENT_SECTION, SEMANTIC_SECTION],
    });
  }

  return createUnknownProfile('generic', type);
}

export function getDeviceProfileCapabilities(profile: DeviceProfile): DeviceCapability[] {
  return profile.capabilityTypes.map((type) => ({
    type,
    name: profile.displayName,
  }));
}
