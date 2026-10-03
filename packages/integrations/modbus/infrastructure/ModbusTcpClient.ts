import { createConnection } from 'node:net';
import type { ModbusTransport } from '../application/ModbusPorts';
import { ModbusError, convertModbusValue, modbusWordCount, type ModbusArea, type ModbusConnection, type ModbusVariable } from '../domain/Modbus';
/** Bounded requests; sockets close on every path and writes are never retried. */
export class ModbusTcpClient implements ModbusTransport {
  private transaction = 0;
  private request(connection: ModbusConnection, pdu: Buffer, signal?: AbortSignal): Promise<Buffer> {
    if (signal?.aborted) return Promise.reject(new ModbusError('CANCELLED', 'Read cancelled'));
    const transaction = this.transaction = (this.transaction + 1) & 0xffff;
    const frame = Buffer.alloc(7 + pdu.length);
    frame.writeUInt16BE(transaction, 0); frame.writeUInt16BE(pdu.length + 1, 4);
    frame[6] = connection.unitId; pdu.copy(frame, 7);
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: connection.host, port: connection.port });
      let data = Buffer.alloc(0), finished = false;
      const finish = (error?: ModbusError, result?: Buffer): void => {
        if (finished) return;
        finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); socket.destroy();
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => finish(new ModbusError('TIMEOUT', 'Modbus request timed out')), connection.timeoutMs);
      const abort = () => finish(new ModbusError('CANCELLED', 'Read cancelled'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      socket.once('connect', () => { if (!finished) socket.write(frame); });
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
        if (response[0] === (pdu[0] | 0x80) && response.length === 2) return finish(new ModbusError('PROTOCOL', 'Modbus exception', response[1]));
        if (response[0] !== pdu[0]) return finish(new ModbusError('PROTOCOL', 'Unexpected Modbus function'));
        finish(undefined, response);
      });
    });
  }
  async read(connection: ModbusConnection, variable: ModbusVariable): Promise<number | boolean> {
    return (await this.readSample(connection, variable)).value;
  }
  async readSample(connection: ModbusConnection, variable: ModbusVariable): Promise<{ raw: Array<number | boolean>; value: number | boolean }> {
    const raw = await this.readRange(connection, variable.area, variable.address, modbusWordCount(variable.dataType));
    return { raw, value: convertModbusValue(raw, variable) };
  }
  async readRange(connection: ModbusConnection, area: ModbusArea, start: number, count: number, signal?: AbortSignal): Promise<Array<number | boolean>> {
    if (!Number.isInteger(start) || !Number.isInteger(count) || count < 1 || count > 64 || start < 0 || start + count > 65536) throw new ModbusError('INVALID_CONFIG', 'Invalid read range');
    const bit = area === 'coil' || area === 'discrete_input';
    const pdu = Buffer.alloc(5); pdu[0] = { coil: 1, discrete_input: 2, holding_register: 3, input_register: 4 }[area];
    pdu.writeUInt16BE(start, 1); pdu.writeUInt16BE(count, 3);
    const response = await this.request(connection, pdu, signal), bytes = bit ? Math.ceil(count / 8) : count * 2;
    if (response.length !== bytes + 2 || response[1] !== bytes) throw new ModbusError('PROTOCOL', 'Invalid Modbus byte count');
    return Array.from({ length: count }, (_, i) => bit ? Boolean(response[2 + Math.floor(i / 8)] & (1 << (i % 8))) : response.readUInt16BE(2 + i * 2));
  }
  async writeCoil(connection: ModbusConnection, address: number, value: boolean): Promise<void> {
    if (!Number.isInteger(address) || address < 0 || address > 65535 || typeof value !== 'boolean') throw new ModbusError('INVALID_CONFIG', 'Invalid coil write');
    const pdu = Buffer.alloc(5); pdu[0] = 5; pdu.writeUInt16BE(address, 1); pdu.writeUInt16BE(value ? 0xff00 : 0, 3);
    const response = await this.request(connection, pdu);
    if (!response.equals(pdu)) throw new ModbusError('PROTOCOL', 'Invalid Modbus write echo');
  }
  async writeHoldingRegisters(connection: ModbusConnection, address: number, words: readonly number[]): Promise<void> {
    if (!Number.isInteger(address) || address < 0 || ![1, 2].includes(words.length) || address + words.length > 65536 || words.some(word => !Number.isInteger(word) || word < 0 || word > 65535)) throw new ModbusError('INVALID_CONFIG', 'Invalid register write');
    const pdu = Buffer.alloc(words.length === 1 ? 5 : 6 + words.length * 2);
    pdu[0] = words.length === 1 ? 6 : 16; pdu.writeUInt16BE(address, 1);
    if (words.length === 1) pdu.writeUInt16BE(words[0], 3);
    else { pdu.writeUInt16BE(words.length, 3); pdu[5] = words.length * 2; words.forEach((word, index) => pdu.writeUInt16BE(word, 6 + index * 2)); }
    const response = await this.request(connection, pdu);
    const expected = words.length === 1 ? pdu : pdu.subarray(0, 5);
    if (!response.equals(expected)) throw new ModbusError('PROTOCOL', 'Invalid register write echo');
  }
}
