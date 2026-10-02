import type { ModbusAddressProfile, ModbusAddressSegment } from '../ModbusAddressProfile';

// User-approved XL5E map. Reserved slots are not proof of physical channels.
const bits: ModbusAddressSegment[] = [
  ['M', 0, 20480, true], ['SM', 36864, 4096, false], ['T', 40960, 4096, false],
  ['C', 45056, 4096, false], ['HM', 49408, 6144, true], ['HT', 57600, 1024, false], ['HC', 58624, 1024, false],
].map(([prefix, base, count, writable]) => ({ prefix: String(prefix), base: Number(base), count: Number(count), writable: Boolean(writable), first: 0, radix: 10, area: 'coil' }));
const registers: ModbusAddressSegment[] = [
  ['D', 0, 20480], ['SD', 28672, 4096], ['TD', 32768, 4096], ['CD', 36864, 4096],
  ['HD', 41088, 6144], ['HTD', 48256, 1024], ['HCD', 49280, 1024],
].map(([prefix, base, count]) => ({ prefix: String(prefix), base: Number(base), count: Number(count), first: 0, radix: 10, area: 'holding_register', writable: false }));
const digital: ModbusAddressSegment[] = ['X', 'Y'].flatMap(prefix => Array.from({ length: 17 }, (_, module) => ({
  prefix, first: module === 0 ? 0 : 4096 + (module - 1) * 64, count: 64, radix: 8,
  base: (prefix === 'X' ? 20480 : 24576) + (module === 0 ? 0 : 256 + (module - 1) * 64),
  area: 'coil', writable: prefix === 'Y', module: module === 0 ? 'CPU' : String(module), channel: prefix === 'X' ? 'inputs' : 'outputs',
})));
export const xinjeXL5E: ModbusAddressProfile = {
  id: 'xinje-xl5e-16t-v1', manufacturer: 'Xinje', family: 'XL5E', model: 'XL5E-16T', version: 1,
  segments: [...bits, ...digital, ...registers],
};
