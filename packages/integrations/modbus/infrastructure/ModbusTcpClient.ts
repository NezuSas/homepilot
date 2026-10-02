import { createConnection } from 'node:net';
import type { ModbusTransport } from '../application/ModbusPorts';
import { ModbusError, type ModbusConnection, type ModbusVariable } from '../domain/Modbus';
/** Bounded requests; sockets close on every path and writes are never retried. */
export class ModbusTcpClient implements ModbusTransport {
  private transaction = 0;
  private request(connection: ModbusConnection, pdu: Buffer): Promise<Buffer> {
    const transaction = this.transaction = (this.transaction + 1) & 0xffff;
    const frame = Buffer.alloc(7 + pdu.length);
    frame.writeUInt16BE(transaction, 0); frame.writeUInt16BE(pdu.length + 1, 4);
    frame[6] = connection.unitId; pdu.copy(frame, 7);
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: connection.host, port: connection.port });
      let data = Buffer.alloc(0), finished = false;
      const finish = (error?: ModbusError, result?: Buffer): void => {
        if (finished) return;
        finished = true; clearTimeout(timer); socket.destroy();
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => finish(new ModbusError('TIMEOUT', 'Modbus request timed out')), connection.timeoutMs);
      socket.once('connect', () => socket.write(frame));
      socket.once('error', () => finish(new ModbusError('CONNECTION', 'Modbus connection failed')));
      socket.once('close', () => finish(new ModbusError('CONNECTION', 'Modbus connection closed before response')));
      socket.on('data', chunk => {
        if (data.length + chunk.length > 260) return finish(new ModbusError('PROTOCOL', 'Oversized Modbus frame'));
        data = Buffer.concat([data, chunk]);
        if (data.length < 7) return;
        const length = data.readUInt16BE(4);
        if (length < 2 || length > 254 || data.readUInt16BE(0) !== transaction || data.readUInt16BE(2) !== 0 || data[6] !== connection.unitId) return finish(new ModbusError('PROTOCOL', 'Invalid Modbus header'));
        if (data.length < length + 6) return;
        if (data.length !== length + 6) return finish(new ModbusError('PROTOCOL', 'Unexpected Modbus data'));
        const response = data.subarray(7);
        if (response[0] === (pdu[0] | 0x80) && response.length === 2) return finish(new ModbusError('PROTOCOL', `Modbus exception ${response[1]}`));
        if (response[0] !== pdu[0]) return finish(new ModbusError('PROTOCOL', 'Unexpected Modbus function'));
        finish(undefined, response);
      });
    });
  }
  async read(connection: ModbusConnection, variable: ModbusVariable): Promise<number | boolean> {
    const count = variable.dataType === 'float32' ? 2 : 1;
    const pdu = Buffer.alloc(5); pdu[0] = { coil: 1, discrete_input: 2, holding_register: 3, input_register: 4 }[variable.area];
    pdu.writeUInt16BE(variable.address, 1); pdu.writeUInt16BE(count, 3);
    const response = await this.request(connection, pdu), bytes = variable.dataType === 'boolean' ? 1 : count * 2;
    if (response.length !== bytes + 2 || response[1] !== bytes) throw new ModbusError('PROTOCOL', 'Invalid Modbus byte count');
    if (variable.dataType === 'boolean') return Boolean(response[2] & 1);
    let value: number;
    if (variable.dataType === 'float32') {
      const payload = Buffer.from(response.subarray(2));
      if (variable.wordOrder === 'low_first') { const first = payload.readUInt16BE(0); payload.writeUInt16BE(payload.readUInt16BE(2), 0); payload.writeUInt16BE(first, 2); }
      value = payload.readFloatBE(0);
    } else value = variable.dataType === 'int16' ? response.readInt16BE(2) : response.readUInt16BE(2);
    value = value * variable.scale + variable.offset;
    if (!Number.isFinite(value)) throw new ModbusError('PROTOCOL', 'Non-finite Modbus reading');
    return value;
  }
  async writeCoil(connection: ModbusConnection, address: number, value: boolean): Promise<void> {
    const pdu = Buffer.alloc(5); pdu[0] = 5; pdu.writeUInt16BE(address, 1); pdu.writeUInt16BE(value ? 0xff00 : 0, 3);
    const response = await this.request(connection, pdu);
    if (!response.equals(pdu)) throw new ModbusError('PROTOCOL', 'Invalid Modbus write echo');
  }
}
