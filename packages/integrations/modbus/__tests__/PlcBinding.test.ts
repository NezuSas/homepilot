import { validateVariable, convertModbusValue, type ModbusDataType } from '../domain/Modbus';
import { encodeModbusValue } from '../domain/ModbusEncoder';
import { resolveModbusAddress } from '../domain/ModbusAddressProfile';
import { validatePlcBinding } from '../domain/PlcBinding';

const profileId = 'xinje-xl5e-16t-v2';
const base = { name: 'Setpoint', profileId, symbolicAddress: 'D100', area: 'holding_register', address: 100, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, writable: true, plc: { role: 'setpoint', min: -100000, max: 100000 } };
describe('Feature: PLC bindings and inverse codec (AC20/AC23/AC24)', () => {
  const command = { name: 'Command', profileId, symbolicAddress: 'M100', area: 'coil', address: 100, dataType: 'boolean', writable: true,
    plc: { role: 'output_command', command: { profileId, symbolicAddress: 'M100' }, feedbackPolicy: 'none' } };
  const point = (symbolicAddress: string) => ({ profileId, symbolicAddress });
  it('Scenario: Historical singular binding remains unchanged (AC37)', () => {
    const v = validateVariable({ ...command, plc: { ...command.plc, role: 'output', physical: point('Y0') } });
    expect(v.plc?.physical?.symbolicAddress).toBe('Y0');
    expect(v.plc).not.toHaveProperty('relatedPhysicalOutputs');
  });
  it.each([{ symbols: ['Y0'] }, { symbols: ['Y0', 'Y1'] }])('Scenario: Declarative outputs $symbols resolve through profile classification (AC37)', ({ symbols }) => {
    const v = validateVariable({ ...command, plc: { ...command.plc, relatedPhysicalOutputs: symbols.map(point) } });
    expect(v.plc?.relatedPhysicalOutputs?.map(p => p.symbolicAddress)).toEqual(symbols);
    expect(v.plc?.feedbackPolicy).toBe('none');
    expect(v.plc?.physical).toBeUndefined();
  });
  it.each(['X0', 'M100', 'D100', 'Y8', 'Y99999'])('Scenario: Related output %s is rejected (AC37)', symbol => {
    expect(() => validateVariable({ ...command, plc: { ...command.plc, relatedPhysicalOutputs: [point(symbol)] } })).toThrow();
  });
  it('Scenario: Duplicate destinations and conflicting singular binding are rejected (AC37)', () => {
    for (const fields of [
      { relatedPhysicalOutputs: [point('Y0'), point('y0')] },
      { physical: point('Y1'), relatedPhysicalOutputs: [point('Y0')] },
      { relatedPhysicalOutputs: [null] }, { relatedPhysicalOutputs: 'Y0' },
      { relatedPhysicalOutputs: [{ profileId: 'xinje-xl5e-16t-v1', symbolicAddress: 'Y0' }] },
    ]) expect(() => validateVariable({ ...command, plc: { ...command.plc, ...fields } })).toThrow();
    expect(validateVariable({ ...command, plc: { ...command.plc, relatedPhysicalOutputs: [] } }).plc).not.toHaveProperty('relatedPhysicalOutputs');
  });
  it('Scenario: Declared outputs respect installed capacity and reject stale PDU metadata (AC37)', () => {
    const v = validateVariable({ ...command, plc: { ...command.plc, relatedPhysicalOutputs: [point('Y1')] } });
    expect(() => validatePlcBinding(v.plc, v, { CPU: { inputs: 8, outputs: 1 } })).toThrow();
    expect(validatePlcBinding(v.plc, v, { CPU: { inputs: 8, outputs: 2 } })?.relatedPhysicalOutputs).toHaveLength(1);
    expect(() => validateVariable({ ...command, plc: { ...command.plc, relatedPhysicalOutputs: [{ ...point('Y0'), area: 'coil', address: 0 }] } })).toThrow();
  });
  it.each(['xinje-xl5e-16t-v1', 'xinje-xl5e-16t-v2'])('Scenario: %s rejects pulses on CPU and all Y expansions (AC33)', id => {
    for (const symbol of ['Y0', ...Array.from({ length: 16 }, (_, index) => `Y${(4096 + index * 64).toString(8)}`)]) {
      const resolved = resolveModbusAddress(id, symbol);
      const output = { name: symbol, profileId: id, symbolicAddress: symbol, area: resolved.area, address: resolved.address, dataType: 'boolean', writable: true,
        plc: { role: 'output_command', command: { profileId: id, symbolicAddress: symbol }, mode: 'sustained' } };
      expect(validateVariable(output).plc?.mode).toBe('sustained');
      expect(() => validateVariable({ ...output, plc: { ...output.plc, mode: 'pulse' } })).toThrow();
    }
  });
  it.each(['uint16', 'int16', 'uint32', 'int32', 'float32'] as ModbusDataType[])('Scenario: %s roundtrips scale offset and word order', dataType => {
    for (const wordOrder of ['high_first', 'low_first']) {
      const variable = validateVariable({ ...base, dataType, wordOrder, scale: 0.1, offset: 2 });
      const value = dataType === 'float32' ? 4.25 : 12;
      expect(convertModbusValue(encodeModbusValue(value, variable), variable)).toBeCloseTo(value, 5);
    }
  });
  it.each(['uint16', 'int16', 'uint32', 'int32', 'float32'] as ModbusDataType[])('Scenario: %s rejects overflow and nonfinite values', dataType => {
    const variable = validateVariable({ ...base, dataType });
    for (const value of [Infinity, NaN, 1e50]) expect(() => encodeModbusValue(value, variable)).toThrow();
    if (dataType !== 'float32') expect(() => encodeModbusValue(1.5, variable)).toThrow();
  });
  it('Scenario: Zero scale and invalid setpoint bounds are rejected', () => {
    expect(() => validateVariable({ ...base, scale: 0 })).toThrow();
    expect(() => validateVariable({ ...base, plc: { role: 'setpoint', min: 40, max: 5 } })).toThrow();
  });
  it.each(['SD100', 'TD100', 'CD100', 'HTD100', 'HCD100', 'X0', 'SM0'])('Scenario: Protected %s cannot enable writes', symbol => {
    const resolved = resolveModbusAddress(profileId, symbol);
    expect(() => validateVariable({ ...base, ...resolved, profileId, symbolicAddress: symbol, dataType: resolved.area === 'coil' ? 'boolean' : 'uint16' })).toThrow();
  });
  it.each(['D100', 'HD100'])('Scenario: V1 %s remains readonly while V2 requires explicit limited setpoint', symbol => {
    const resolved = resolveModbusAddress(profileId, symbol);
    expect(validateVariable({ ...base, ...resolved, profileId, symbolicAddress: symbol }).plc?.role).toBe('setpoint');
    expect(() => validateVariable({ ...base, ...resolved, profileId: 'xinje-xl5e-16t-v1', symbolicAddress: symbol })).toThrow();
    expect(() => validateVariable({ ...base, ...resolved, profileId, symbolicAddress: symbol, plc: undefined })).toThrow();
  });
  it('Scenario: Generic register writes and identical command feedback cannot bypass policy', () => {
    expect(() => validateVariable({ ...base, profileId: undefined, symbolicAddress: undefined })).toThrow();
    const resolved = resolveModbusAddress(profileId, 'M100');
    expect(() => validateVariable({ ...base, ...resolved, dataType: 'boolean', profileId, symbolicAddress: 'M100', plc: { role: 'output_command', command: { profileId, symbolicAddress: 'M100' }, feedback: { profileId, symbolicAddress: 'M100' }, feedbackPolicy: 'required' } })).toThrow();
  });
  it('Scenario: Pulse and feedback limits reject unsafe duration and physical Y pulse', () => {
    const output = { ...base, area: 'coil', address: 100, dataType: 'boolean', symbolicAddress: 'M100', plc: { role: 'output_command', command: { profileId, symbolicAddress: 'M100' }, mode: 'pulse', pulseDurationMs: 500 } };
    for (const pulseDurationMs of [0, 99, 5001, Infinity]) expect(() => validateVariable({ ...output, plc: { ...output.plc, pulseDurationMs } })).toThrow();
    for (const feedbackTimeoutMs of [249, 10001]) expect(() => validateVariable({ ...output, plc: { ...output.plc, feedbackTimeoutMs } })).toThrow();
    const y = resolveModbusAddress(profileId, 'Y0');
    expect(() => validateVariable({ ...output, address: y.address, symbolicAddress: 'Y0', plc: { ...output.plc, command: { profileId, symbolicAddress: 'Y0' } } })).toThrow();
  });
});
