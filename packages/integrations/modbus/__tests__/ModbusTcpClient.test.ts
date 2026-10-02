import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import { ModbusTcpClient } from '../infrastructure/ModbusTcpClient';
import type { ModbusConnection, ModbusVariable } from '../domain/Modbus';

describe('Feature: Native Modbus TCP protocol (AC3/AC4)', () => {
  let server: Server;
  const sockets = new Set<Socket>();
  const client = new ModbusTcpClient();
  const variable: ModbusVariable = { deviceId: 'v', connectionId: 'c', name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false, wordOrder: 'high_first' };
  async function plc(reply: (request: Buffer, socket: Socket) => void): Promise<ModbusConnection> {
    server = createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      let request = Buffer.alloc(0);
      socket.on('data', chunk => { request = Buffer.concat([request, chunk]); if (request.length >= 12) reply(request, socket); });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return { id: 'c', homeId: 'h', name: 'Simulated PLC', host: '127.0.0.1', port: (server.address() as AddressInfo).port, unitId: 1, timeoutMs: 500, pollIntervalMs: 1000, enabled: true };
  }
  function frame(request: Buffer, pdu: number[] | Buffer): Buffer {
    const output = Buffer.alloc(7 + pdu.length); request.copy(output, 0, 0, 7);
    output.writeUInt16BE(pdu.length + 1, 4); Buffer.from(pdu).copy(output, 7); return output;
  }
  afterEach(async () => { for (const socket of sockets) socket.destroy(); if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
  it.each([['coil', 1], ['discrete_input', 2], ['holding_register', 3], ['input_register', 4]] as const)
    ('Scenario: Given %s When a read is sent Then its function and zero-based address are honored', async (area, code) => {
      const connection = await plc((request, socket) => {
        expect(request[7]).toBe(code); expect(request.readUInt16BE(8)).toBe(100); expect(request.readUInt16BE(10)).toBe(1);
        socket.end(frame(request, code < 3 ? [code, 1, 1] : [code, 2, 0x12, 0x34]));
      });
      expect(await client.read(connection, { ...variable, area, dataType: code < 3 ? 'boolean' : 'uint16' })).toBe(code < 3 ? true : 0x1234);
    });
  it('Scenario: Given signed registers When read with scaling Then the engineering value is decoded', async () => {
    const connection = await plc((request, socket) => socket.end(frame(request, [3, 2, 0xff, 0x9c])));
    expect(await client.read(connection, { ...variable, dataType: 'int16', scale: 0.1, offset: 2 })).toBe(-8);
  });
  it.each(['high_first', 'low_first'] as const)('Scenario: Given float32 %s When two registers are read Then word order is respected', async wordOrder => {
    const payload = Buffer.alloc(4); payload.writeFloatBE(22.5);
    if (wordOrder === 'low_first') { const first = payload.readUInt16BE(0); payload.writeUInt16BE(payload.readUInt16BE(2), 0); payload.writeUInt16BE(first, 2); }
    const connection = await plc((request, socket) => { expect(request.readUInt16BE(10)).toBe(2); socket.end(frame(request, Buffer.concat([Buffer.from([3, 4]), payload]))); });
    expect(await client.read(connection, { ...variable, dataType: 'float32', wordOrder })).toBe(22.5);
  });
  it('Scenario: Given a fragmented TCP response When both pieces arrive Then it is assembled', async () => {
    const connection = await plc((request, socket) => { const response = frame(request, [3, 2, 0, 42]); socket.write(response.subarray(0, 5)); setImmediate(() => socket.end(response.subarray(5))); });
    expect(await client.read(connection, variable)).toBe(42);
  });
  it.each(['transaction', 'protocol', 'unit', 'function', 'length', 'count', 'exception', 'oversize', 'nan'] as const)
    ('Scenario: Given invalid %s When received Then the response is rejected', async fault => {
      const connection = await plc((request, socket) => {
        let response = frame(request, [3, 2, 0, 42]);
        if (fault === 'transaction') response.writeUInt16BE(999, 0);
        if (fault === 'protocol') response.writeUInt16BE(1, 2);
        if (fault === 'unit') response[6] = 2;
        if (fault === 'function') response[7] = 4;
        if (fault === 'length') response.writeUInt16BE(1, 4);
        if (fault === 'count') response[8] = 4;
        if (fault === 'exception') response = frame(request, [0x83, 2]);
        if (fault === 'oversize') response = Buffer.alloc(300);
        if (fault === 'nan') { const value = Buffer.alloc(4); value.writeFloatBE(NaN); response = frame(request, Buffer.concat([Buffer.from([3, 4]), value])); }
        socket.end(response);
      });
      await expect(client.read(connection, { ...variable, dataType: fault === 'nan' ? 'float32' : 'uint16' })).rejects.toMatchObject({ code: 'PROTOCOL' });
    });
  it('Scenario: Given an unanswered request When deadline expires Then timeout closes the socket', async () => {
    const connection = await plc(() => undefined);
    await expect(client.read({ ...connection, timeoutMs: 20 }, variable)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
  it('Scenario: Given premature socket close When reading Then failure is explicit', async () => {
    const connection = await plc((_request, socket) => socket.end());
    await expect(client.read(connection, variable)).rejects.toMatchObject({ code: 'CONNECTION' });
  });
  it.each([true, false])('Scenario: Given coil %s When written Then exact FC05 echo is required', async value => {
    const connection = await plc((request, socket) => { expect(request[7]).toBe(5); expect(request.readUInt16BE(8)).toBe(123); expect(request.readUInt16BE(10)).toBe(value ? 0xff00 : 0); socket.end(request); });
    await client.writeCoil(connection, 123, value);
  });
  it('Scenario: Given an invalid write echo When writing Then no automatic retry occurs', async () => {
    let count = 0;
    const connection = await plc((request, socket) => { count++; request[11] = 1; socket.end(request); });
    await expect(client.writeCoil(connection, 123, true)).rejects.toMatchObject({ code: 'PROTOCOL' }); expect(count).toBe(1);
  });
  it('Scenario: Given a register range When probed Then one FC03 reads exact unsigned RAW words', async () => {
    const connection = await plc((request, socket) => { expect(request[7]).toBe(3); expect(request.readUInt16BE(8)).toBe(100); expect(request.readUInt16BE(10)).toBe(3); socket.end(frame(request, [3, 6, 0xff, 0xff, 0, 22, 0, 1])); });
    expect(await client.readRange(connection, 'holding_register', 100, 3)).toEqual([65535, 22, 1]);
  });
  it('Scenario: Given a bit range across bytes When probed Then every RAW bit is expanded in address order', async () => {
    const connection = await plc((request, socket) => { expect(request[7]).toBe(2); socket.end(frame(request, [2, 2, 0x81, 1])); });
    expect(await client.readRange(connection, 'discrete_input', 100, 9)).toEqual([true, false, false, false, false, false, false, true, true]);
  });
  it.each(['uint32', 'int32'] as const)('Scenario: Given %s When the driver reads Then both words use the common decoder', async dataType => {
    const connection = await plc((request, socket) => { expect(request.readUInt16BE(10)).toBe(2); socket.end(frame(request, [3, 4, 0xff, 0xff, 0xff, 0xfe])); });
    expect(await client.read(connection, { ...variable, dataType })).toBe(dataType === 'uint32' ? 4294967294 : -2);
  });
  it('Scenario: Given a waiting probe When aborted Then the socket closes without write or retry', async () => {
    let started!: () => void; const sent = new Promise<void>(resolve => { started = resolve; });
    const connection = await plc(() => started()); const controller = new AbortController();
    const read = client.readRange(connection, 'holding_register', 100, 3, controller.signal);
    await sent; controller.abort(); await expect(read).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('Scenario: Given an invalid range When requested Then no network is contacted', async () => {
    const connection = await plc(() => { throw new Error('Unexpected network'); });
    await expect(client.readRange(connection, 'holding_register', 65535, 2)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await expect(client.readRange(connection, 'holding_register', 0, 65)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });
});
