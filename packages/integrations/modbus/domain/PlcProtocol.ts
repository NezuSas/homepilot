/**
 * The protocols a PLC connection can speak. A connection names its protocol and the service looks up the
 * matching transport, so adding one (Modbus RTU through a serial gateway, for instance) is a new transport
 * and a new entry here, not a change to the service, the API or the stored connections.
 *
 * Every protocol here shares the register model of the variables (area, address, data type), which is
 * what `ModbusTransport` exposes. Protocols with another addressing model (OPC UA node ids, MQTT topics,
 * S7 data blocks) need that model widened first; see `modbus-protocol-extensibility-v1`.
 */
export const PLC_PROTOCOLS = ['modbus-tcp'] as const;
export type PlcProtocolId = typeof PLC_PROTOCOLS[number];

/** Connections saved before the protocol was recorded are Modbus TCP. */
export const DEFAULT_PLC_PROTOCOL: PlcProtocolId = 'modbus-tcp';

export function isPlcProtocolId(value: unknown): value is PlcProtocolId {
  return typeof value === 'string' && (PLC_PROTOCOLS as readonly string[]).includes(value);
}
