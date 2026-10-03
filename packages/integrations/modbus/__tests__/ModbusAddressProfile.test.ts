import { resolveModbusAddress, resolveModbusRange, validateModuleCapacities, validateProfileMapping, addressProfile } from '../domain/ModbusAddressProfile';
import { convertModbusValue, validateVariable } from '../domain/Modbus';

const profileId = 'xinje-xl5e-16t-v1';
describe('Feature: PLC address profiles — Xinje explicit map (AC11/AC12/AC13)', () => {
  it('Scenario: Profile owns resolution formatting and capacity validation (AC33)', () => {
    const profile = addressProfile(profileId);
    const resolve = jest.spyOn(profile, 'resolve');
    const format = jest.spyOn(profile, 'format');
    const capacities = jest.spyOn(profile, 'validateCapacities');
    try {
      resolveModbusRange(profileId, 'X7', 'X10');
      expect(resolve).toHaveBeenCalledWith('X7', undefined);
      expect(format).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'X' }), 8);
      expect(validateModuleCapacities({ CPU: { inputs: 8, outputs: 4 } }, profileId)).toEqual({ CPU: { inputs: 8, outputs: 4 } });
      expect(capacities).toHaveBeenCalledWith({ CPU: { inputs: 8, outputs: 4 } });
    } finally { resolve.mockRestore(); format.mockRestore(); capacities.mockRestore(); }
  });
  it('Scenario: Common capacity validation delegates without imposing Xinje module names (AC33)', () => {
    // Override only the policy in this isolated test; no extra profile is registered.
    const validateCapacities = jest.spyOn(addressProfile(profileId), 'validateCapacities').mockReturnValue({ rack: { inputs: 128, outputs: 2 } });
    try {
      expect(validateModuleCapacities({ rack: { inputs: 128, outputs: 2 } }, profileId)).toEqual({ rack: { inputs: 128, outputs: 2 } });
      expect(validateCapacities).toHaveBeenCalledWith({ rack: { inputs: 128, outputs: 2 } });
    } finally { validateCapacities.mockRestore(); }
    expect(() => validateModuleCapacities({ CPU: { inputs: 8, outputs: 8 } })).toThrow();
  });
  it.each(['xinje-xl5e-16t-v1', 'xinje-xl5e-16t-v2'])('Scenario: %s preserves every map and auxiliary area policy (AC33)', id => {
    expect(addressProfile(id).booleanBindingAreas).toEqual(['coil']);
    for (const segment of addressProfile(id).segments) {
      const symbol = addressProfile(id).format(segment, segment.first);
      const resolved = resolveModbusAddress(id, symbol);
      expect([resolved.area, resolved.address]).toEqual([segment.area, segment.base]);
      expect(resolved.segment.supportsPulse).toBe(['M', 'HM'].includes(segment.prefix));
      expect(resolved.segment.supportsSetpoint).toBe(id.endsWith('-v2') && ['D', 'HD'].includes(segment.prefix));
    }
  });
  it.each([
    ['M100', 'coil', 100], ['M199', 'coil', 199], ['X0', 'coil', 20480], ['X7', 'coil', 20487],
    ['Y0', 'coil', 24576], ['Y7', 'coil', 24583], ['D100', 'holding_register', 100],
    ['SM5', 'coil', 36869], ['T20', 'coil', 40980], ['C30', 'coil', 45086], ['HD100', 'holding_register', 41188],
    ['HTD20', 'holding_register', 48276], ['HCD20', 'holding_register', 49300],
    ['X10000', 'coil', 20736], ['X10007', 'coil', 20743], ['X10010', 'coil', 20744], ['Y10000', 'coil', 24832],
    ['SD0', 'holding_register', 28672], ['TD0', 'holding_register', 32768], ['CD0', 'holding_register', 36864],
    ['HM0', 'coil', 49408], ['HT0', 'coil', 57600], ['HC0', 'coil', 58624],
  ])('Scenario: %s resolves to %s PDU %i', (symbol, area, address) => expect(resolveModbusAddress(profileId, symbol)).toMatchObject({ area, address, symbolicAddress: symbol }));
  it.each(Array.from({ length: 16 }, (_, i) => i + 1))('Scenario: Expansion %i maps both octal bases and last reserved positions', module => {
    const suffix = (4096 + (module - 1) * 64).toString(8);
    expect(resolveModbusAddress(profileId, `X${suffix}`).address).toBe(20736 + (module - 1) * 64);
    expect(resolveModbusAddress(profileId, `Y${suffix}`).address).toBe(24832 + (module - 1) * 64);
    expect(resolveModbusAddress(profileId, `X${(4096 + module * 64 - 1).toString(8)}`).address).toBe(20736 + module * 64 - 1);
  });
  it.each(addressProfile(profileId).segments.filter(segment => !segment.module))('Scenario: Segment $prefix has exact inclusive bounds', segment => {
    expect(resolveModbusAddress(profileId, `${segment.prefix}0`).address).toBe(segment.base);
    expect(resolveModbusAddress(profileId, `${segment.prefix}${segment.count - 1}`).address).toBe(segment.base + segment.count - 1);
    expect(() => resolveModbusAddress(profileId, `${segment.prefix}${segment.count}`)).toThrow();
  });
  it.each(['X8', 'Y9', 'X10008', 'X100', 'X12000', 'D20480', 'SM4096', 'D-1', 'D1.5', '40001', 'D', 'X000', 'UNKNOWN1'])
    ('Scenario: Invalid or out-of-map %s is rejected', symbol => expect(() => resolveModbusAddress(profileId, symbol)).toThrow());
  it('Scenario: Unknown profile is rejected', () => expect(() => resolveModbusAddress('other', 'D100')).toThrow());
  it('Scenario: Octal range crosses 7 to 10 without decimal addresses', () => expect(resolveModbusRange(profileId, 'X10007', 'X10010').map(item => [item.symbolicAddress, item.address])).toEqual([['X10007', 20743], ['X10010', 20744]]));
  it.each([['D100', 'D99'], ['M0', 'D2'], ['D0', 'D64'], ['X77', 'X10000'], ['X10077', 'X10100']])
    ('Scenario: Incompatible range %s to %s is rejected', (start, end) => expect(() => resolveModbusRange(profileId, start, end)).toThrow());
  it('Scenario: Reserved capacity is not claimed as physical and explicit channels limit range', () => {
    expect(resolveModbusAddress(profileId, 'X10010').physicalCapacityKnown).toBe(false);
    const capacities = { '1': { inputs: 8, outputs: 4 } };
    expect(resolveModbusAddress(profileId, 'X10007', capacities).physicalCapacityKnown).toBe(true);
    expect(() => resolveModbusAddress(profileId, 'X10010', capacities)).toThrow();
    expect(() => resolveModbusAddress(profileId, 'Y10004', capacities)).toThrow();
    expect(() => resolveModbusRange(profileId, 'X10000', 'X10010', capacities)).toThrow();
  });
  it.each([{ '17': { inputs: 8, outputs: 8 } }, { CPU: { inputs: -1, outputs: 8 } }, { CPU: { inputs: 65, outputs: 8 } }, { CPU: { inputs: 1.5, outputs: 8 } }, { CPU: { inputs: 8 } }])
    ('Scenario: Invalid capacities %j are rejected', value => expect(() => validateModuleCapacities(value, profileId)).toThrow());
  it('Scenario: Profile metadata must agree with effective address and system areas cannot write', () => {
    expect(() => validateVariable({ name: 'SM5', profileId, symbolicAddress: 'SM5', area: 'coil', address: 36869, dataType: 'boolean', writable: true })).toThrow();
    expect(() => validateVariable({ name: 'D100', profileId, symbolicAddress: 'D100', area: 'holding_register', address: 101, dataType: 'uint16' })).toThrow();
    expect(() => validateVariable({ name: 'X0', profileId, symbolicAddress: 'X0', area: 'coil', address: 20480, dataType: 'boolean', writable: true })).toThrow();
    expect(() => validateVariable({ name: 'D20479', profileId, symbolicAddress: 'D20479', area: 'holding_register', address: 20479, dataType: 'uint32' })).toThrow();
  });
  it.each([
    ['uint16', 'high_first', [22], 22], ['int16', 'high_first', [65534], -2],
    ['uint32', 'high_first', [1, 2], 65538], ['int32', 'high_first', [65535, 65534], -2],
    ['uint32', 'low_first', [2, 1], 65538], ['float32', 'high_first', [0x41b4, 0], 22.5], ['float32', 'low_first', [0, 0x41b4], 22.5],
  ] as const)('Scenario: D100 %s %s uses shared decoder', (dataType, wordOrder, words, expected) => {
    const resolved = resolveModbusAddress(profileId, 'D100');
    const variable = validateVariable({ name: 'D100', profileId, symbolicAddress: 'D100', area: resolved.area, address: resolved.address, dataType, wordOrder, scale: 0.1, offset: 2 });
    validateProfileMapping(variable, words.length);
    expect(convertModbusValue(words, variable)).toBeCloseTo(expected * 0.1 + 2);
  });
});
