import { presentProbeRows } from '../modbusProbePresentation';
import type { ModbusProbeRow } from '../../../../../packages/integrations/modbus/domain/Modbus';

const rows: ModbusProbeRow[] = [
  { address: 100, raw: 0x41b4, status: 'ok', elapsedMs: 1 },
  { address: 101, raw: 0, status: 'ok', elapsedMs: 1 },
  { address: 102, raw: 42, status: 'error', error: 'TIMEOUT', elapsedMs: 1 },
];
const config = { dataType: 'uint16' as const, scale: 1, offset: 0, wordOrder: 'high_first' as const };
describe('Modbus table filters (AC16)', () => {
  it('preserves zero and previous/error samples in All', () => {
    expect(presentProbeRows(rows, config, 'all').map(item => item.value)).toEqual([16820, 0, null]);
  });
  it('keeps zero as a valid reading, excludes stale errors', () => {
    expect(presentProbeRows(rows, config, 'valid').map(item => item.row.address)).toEqual([100, 101]);
  });
  it('filters non-zero RAW after decoding the original two-word block', () => {
    expect(presentProbeRows(rows, { ...config, dataType: 'float32', scale: 0.1, offset: 2 }, 'active'))
      .toEqual([{ row: rows[0], value: 4.25 }]);
  });
  it('does not join registers across gaps or invent an incomplete pair', () => {
    expect(presentProbeRows([rows[0], { ...rows[1], address: 103 }], { ...config, dataType: 'uint32' }, 'valid')).toEqual([]);
  });
  it('invalid numeric drafts have no creatable preview', () => {
    expect(presentProbeRows(rows, { ...config, scale: NaN }, 'valid')).toEqual([]);
  });
  it('only active bits remain without conflating false with an error', () => {
    const bits = [true, false].map((raw, address) => ({ raw, address, status: 'ok' as const, elapsedMs: 1 }));
    expect(presentProbeRows(bits, { ...config, dataType: 'boolean' }, 'valid')).toHaveLength(2);
    expect(presentProbeRows(bits, { ...config, dataType: 'boolean' }, 'active').map(item => item.value)).toEqual([true]);
  });
});
