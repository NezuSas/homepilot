import { renderToStaticMarkup } from 'react-dom/server';
import { addressProfile } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import type { ModbusAddressProfile, ModbusAddressSegment } from '../../../../packages/integrations/modbus/domain/ModbusProfileDefinition';
import { ModbusSemanticPointSelector } from './ModbusSemanticPointSelector';
import { ModbusVariablePointEditor } from './ModbusVariablePointEditor';
import { plcPointAddress } from '../lib/modbusSemanticDraft';
import * as numbers from './ui/NumberInput';
import * as selects from './ui/SearchableSelectField';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('Feature: Reusable semantic addressing selector (AC42)', () => {
  const profile = addressProfile('xinje-xl5e-16t-v2');
  it.each([['input', 'X0', 'FC01'], ['output', 'Y0', 'FC01'], ['output_command', 'M100', 'FC01'], ['measurement', 'D110', 'FC03'], ['input', 'X10000', 'FC01'], ['output', 'Y10000', 'FC01']] as const)('Scenario: %s displays resolved %s and %s without mutating configuration (AC42)', (role, symbol, fc) => {
    const onChange = jest.fn(), value = plcPointAddress(profile, profile.resolve(symbol));
    const before = JSON.stringify(value);
    const html = renderToStaticMarkup(<ModbusSemanticPointSelector profile={profile} role={role} label="Point" value={value} onChange={onChange} capacities={{ '1': { inputs: 8, outputs: 8 } }} />);
    expect(html).toContain(symbol); expect(html).toContain(fc); expect(html).toContain(`PDU ${value.address}`);
    expect(onChange).not.toHaveBeenCalled(); expect(JSON.stringify(value)).toBe(before);
  });
  const assertOrdinalSelection = (ordinal: number, symbol: string) => {
    const original = numbers.NumberInput;
    // Capture public callback without replacing the shared primitive behavior.
    const spy = jest.spyOn(numbers, 'NumberInput').mockImplementation(props => original(props));
    const format = jest.spyOn(profile, 'format'), resolve = jest.spyOn(profile, 'resolve'), onChange = jest.fn();
    try {
      renderToStaticMarkup(<ModbusSemanticPointSelector profile={profile} role="input" kind="physical_input" label="Point" onChange={onChange} />);
      spy.mock.calls[0][0].onValueChange(ordinal);
      expect(format).toHaveBeenCalledWith(expect.objectContaining({ radix: 8 }), ordinal);
      expect(resolve).toHaveBeenCalledWith(symbol, undefined);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ symbolicAddress: symbol, address: 20480 + ordinal }));
    } finally { spy.mockRestore(); format.mockRestore(); resolve.mockRestore(); }
  };
  it('Scenario: Ordinal selection delegates format and resolve, preserving octal channels (AC42)', () => {
    assertOrdinalSelection(8, 'X10');
  });
  it.each([[0, 'X0'], [1, 'X1'], [7, 'X7']] as const)('Scenario: Ordinal %s delegates format and resolve to %s, preserving octal channels (AC42)', assertOrdinalSelection);
  it('Scenario: Unknown capacity is reserved and a declared zero capacity offers no channels (AC42)', () => {
    const render = (capacities?: { CPU: { inputs: number; outputs: number } }) => renderToStaticMarkup(<ModbusSemanticPointSelector profile={profile} role="input" kind="physical_input" label="Point" capacities={capacities} onChange={() => {}} />);
    expect(render()).toContain('modbus.reserved_capacity');
    expect(render({ CPU: { inputs: 0, outputs: 0 } })).toContain('plc.semantic.no_channels');
    expect(render({ CPU: { inputs: 65, outputs: 0 } })).toContain('plc.semantic.invalid_capacity');
  });
  it('Scenario: Role options are metadata-driven and exclude incompatible families (AC42)', () => {
    const original = selects.SearchableSelectField;
    const spy = jest.spyOn(selects, 'SearchableSelectField').mockImplementation(props => original(props));
    try {
      renderToStaticMarkup(<ModbusSemanticPointSelector profile={profile} role="setpoint" label="Point" onChange={() => {}} />);
      expect(spy.mock.calls[0][0].options.map(item => item.value)).toEqual(['D', 'HD']);
    } finally { spy.mockRestore(); }
  });
  it('Scenario: PORT hexadecimal test profile uses the same component with no Xinje branches (AC42)', () => {
    const segment: ModbusAddressSegment = { prefix: 'PORT', first: 16, count: 32, radix: 16, base: 300, area: 'discrete_input', module: 'rack-alpha', channel: 'inputs', writable: false, supportsPulse: false, supportsSetpoint: false, semantics: { familyId: 'contacts', kind: 'physical_input', compatibleRoles: ['input'] } };
    const alternative: ModbusAddressProfile = { id: 'fixture', manufacturer: 'Fixture', family: 'Fixture', model: 'Fixture', version: 1, segments: [segment], booleanBindingAreas: ['discrete_input'], maxRangeLength: 8, validateCapacities: () => undefined,
      format: (s, index) => `${s.prefix}:${index.toString(s.radix).toUpperCase()}`,
      resolve: symbol => ({ symbolicAddress: symbol, segment, area: segment.area, address: segment.base + Number.parseInt(symbol.slice(5), segment.radix) - segment.first, physicalCapacityKnown: false }) };
    const html = renderToStaticMarkup(<ModbusSemanticPointSelector profile={alternative} role="input" label="Point" value={plcPointAddress(alternative, alternative.resolve('PORT:1A'))} onChange={() => {}} />);
    expect(html).toContain('PORT:1A'); expect(html).toContain('rack-alpha'); expect(html).toContain('contacts'); expect(html).toContain('PDU 310'); expect(html).toContain('FC02');
  });
  it('Scenario: Opening a historical editor keeps every point and binding unchanged (AC42)', () => {
    const variable = { name: 'Historical', profileId: profile.id, symbolicAddress: 'M100', area: 'coil' as const, address: 100, dataType: 'boolean' as const, scale: 1, offset: 0, wordOrder: 'high_first' as const, unit: '', writable: true, plc: { role: 'output_command' as const, command: plcPointAddress(profile, profile.resolve('M100')), physical: plcPointAddress(profile, profile.resolve('M100')), feedbackPolicy: 'none' as const, mode: 'sustained' as const, pulseDurationMs: 500, feedbackTimeoutMs: 2000 } };
    const before = JSON.stringify(variable), onChange = jest.fn();
    const html = renderToStaticMarkup(<ModbusVariablePointEditor variable={variable} historical onChange={onChange} advancedField={<p>M100 · PDU 100</p>} />);
    expect(html).toContain('M100'); expect(html).toContain('plc.semantic.advanced'); expect(onChange).not.toHaveBeenCalled(); expect(JSON.stringify(variable)).toBe(before);
  });
});
