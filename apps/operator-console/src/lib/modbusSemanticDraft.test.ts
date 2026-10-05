import { addressProfile } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { profileChannel } from '../../../../packages/integrations/modbus/domain/ModbusProfileMetadata';
import { changeDraftProfile, changeDraftRole, displayedInputSource, hasPlcRelations, plcPointAddress, selectPhysicalPoint, selectPrimaryPoint, validateSemanticDraft, type ModbusVariableDraft } from './modbusSemanticDraft';

const profile = addressProfile('xinje-xl5e-16t-v2');
const base: ModbusVariableDraft = { name: 'Fixture', profileId: profile.id, symbolicAddress: 'D110', area: 'holding_register', address: 110, dataType: 'int16', scale: 0.1, offset: 0, wordOrder: 'high_first', unit: '°C', writable: false };
const point = (symbol: string) => plcPointAddress(profile, profile.resolve(symbol));

describe('Feature: Semantic variable editor draft (AC42)', () => {
  it.each([['input', 'X0'], ['output_command', 'M100'], ['measurement', 'D110'], ['setpoint', 'D110']] as const)('Scenario: %s uses an explicit %s selection, never inferred Ladder links (AC42)', (role, symbol) => {
    const draft = selectPrimaryPoint(changeDraftRole(base, role), point(symbol));
    expect(draft.symbolicAddress).toBe(symbol);
    expect(draft.address).toBe(profile.resolve(symbol).address);
    expect(draft.plc?.logical).toBeUndefined(); expect(draft.plc?.feedback).toBeUndefined(); expect(draft.plc?.relatedPhysicalOutputs).toBeUndefined();
    expect(draft.plc?.physical).toBeUndefined(); expect(draft.writable).toBe(false);
  });
  it('Scenario: Ordinal eight is formatted by the profile, not decimal concatenation (AC42)', () => {
    const segment = profile.resolve('X0').segment;
    expect(selectPrimaryPoint(base, plcPointAddress(profile, profileChannel(profile, segment, 8))).symbolicAddress).toBe('X10');
  });
  it('Scenario: Selecting physical Y0 does not infer M200 or overwrite an existing command (AC42)', () => {
    const original = selectPrimaryPoint(changeDraftRole(base, 'output'), point('M200'));
    const draft = selectPhysicalPoint(original, point('Y0'));
    expect(draft.plc?.physical?.symbolicAddress).toBe('Y0'); expect(draft.symbolicAddress).toBe('M200');
    expect(draft.plc?.command).toEqual(original.plc?.command);
    expect(() => validateSemanticDraft(draft, profile)).not.toThrow();
  });
  it('Scenario: Historical configuration remains byte-for-byte unchanged during inspection (AC42)', () => {
    const historical = { ...base, plc: { ...changeDraftRole(base, 'input').plc!, physical: point('X1'), logical: point('M1') } };
    const before = JSON.stringify(historical);
    expect(hasPlcRelations(historical)).toBe(true); expect(displayedInputSource(historical)).toBe('M1');
    expect(JSON.stringify(historical)).toBe(before);
    const changed = changeDraftRole(historical, 'output_command');
    expect(changed.address).toBe(110); expect(changed.plc?.physical).toBeUndefined();
    expect(changed.plc?.command).toBeUndefined(); expect(JSON.stringify(historical)).toBe(before);
  });
  it('Scenario: Confirmed profile changes preserve PDU until explicit reselection (AC42)', () => {
    const changed = changeDraftProfile(base, 'xinje-xl5e-16t-v1');
    expect(changed.address).toBe(base.address); expect(changed.area).toBe(base.area); expect(changed.symbolicAddress).toBeUndefined();
    expect(() => validateSemanticDraft({ ...changed, plc: changeDraftRole(base, 'measurement').plc }, addressProfile(changed.profileId!))).toThrow();
    expect(changeDraftProfile(base, '').profileId).toBeUndefined();
  });
  it('Scenario: New configurations reject incompatible physical or usage points without changing historical validators (AC42)', () => {
    const output = selectPrimaryPoint(changeDraftRole(base, 'output'), point('M200'));
    expect(() => validateSemanticDraft({ ...output, plc: { ...output.plc!, physical: point('M100') } }, profile)).toThrow();
    expect(() => validateSemanticDraft(selectPrimaryPoint(changeDraftRole(base, 'measurement'), point('M100')), profile)).toThrow();
    expect(() => validateSemanticDraft(selectPrimaryPoint(changeDraftRole(base, 'setpoint'), point('D110')), addressProfile('xinje-xl5e-16t-v1'))).toThrow();
  });
});
