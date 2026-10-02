import { convertModbusValue, modbusWordCount, type ModbusProbeRow, type ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';

export function presentProbeRows(rows: ModbusProbeRow[], conversion: Pick<ModbusVariable, 'dataType' | 'scale' | 'offset' | 'wordOrder'>, filter: string) {
  // Decode against the unfiltered block: the low word may be zero or hidden.
  return rows.map((row, index) => {
    let value: number | boolean | null = null;
    try {
      const words = rows.slice(index, index + modbusWordCount(conversion.dataType));
      if (words.length !== modbusWordCount(conversion.dataType) || words.some((word, offset) => word.address !== row.address + offset || word.status !== 'ok' || word.raw === null)
        || !Number.isFinite(conversion.scale) || conversion.scale === 0 || !Number.isFinite(conversion.offset)) throw new Error();
      value = convertModbusValue(words.map(word => word.raw!), conversion);
    } catch { /* Missing/invalid readings never become fabricated previews. */ }
    return { row, value };
  }).filter(({ row, value }) => filter === 'all' || (row.status === 'ok' && value !== null && (filter !== 'active' || (row.raw !== 0 && row.raw !== false))));
}
