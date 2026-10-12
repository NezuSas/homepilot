import { ModbusError } from '../domain/Modbus';
import type { PlcProtocolId } from '../domain/PlcProtocol';
import type { ModbusTransport, PlcTransportRegistry } from '../application/ModbusPorts';

/** One transport per protocol; asking for a protocol nobody registered is a configuration error, never a silent fallback. */
export class DefaultPlcTransportRegistry implements PlcTransportRegistry {
  private readonly transports = new Map<PlcProtocolId, ModbusTransport>();

  register(protocol: PlcProtocolId, transport: ModbusTransport): this {
    this.transports.set(protocol, transport);
    return this;
  }

  transportFor(protocol: PlcProtocolId): ModbusTransport {
    const transport = this.transports.get(protocol);
    if (!transport) throw new ModbusError('INVALID_CONFIG', `Unsupported PLC protocol: ${protocol}`);
    return transport;
  }
}
