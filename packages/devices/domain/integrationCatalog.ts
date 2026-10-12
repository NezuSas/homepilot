/**
 * What each integration source is, in one place: its display name, what kind of thing it connects and
 * whether its devices behave as PLC points. Generic code asks the catalog instead of comparing source
 * ids, so a new protocol is one more entry here and not a search through the codebase.
 */
export type IntegrationKind = 'bridge' | 'local_network' | 'camera' | 'plc' | 'display';

export interface IntegrationInfo {
  readonly id: string;
  /** Proper name shown to people; not translated. */
  readonly name: string;
  readonly kind: IntegrationKind;
}

const INTEGRATIONS: readonly IntegrationInfo[] = [
  { id: 'ha', name: 'Home Assistant', kind: 'bridge' },
  { id: 'sonoff', name: 'Sonoff', kind: 'local_network' },
  { id: 'native-camera', name: 'Cámara IP', kind: 'camera' },
  { id: 'modbus-tcp', name: 'Modbus TCP', kind: 'plc' },
  { id: 'android-display', name: 'Android', kind: 'display' },
];

/** Older records spell the same sources differently. */
const ALIASES: Readonly<Record<string, string>> = { 'home-assistant': 'ha' };

export function integrationInfo(source: string | null | undefined): IntegrationInfo | null {
  if (!source) return null;
  const id = ALIASES[source] ?? source;
  return INTEGRATIONS.find(integration => integration.id === id) ?? null;
}

/** True when the devices of this source are PLC points (inputs, outputs, commands, setpoints). */
export function isPlcIntegration(source: string | null | undefined): boolean {
  return integrationInfo(source)?.kind === 'plc';
}
