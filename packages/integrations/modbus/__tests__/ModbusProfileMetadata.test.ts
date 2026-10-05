import { addressProfile } from '../domain/ModbusAddressProfile';
import { profileFamilies, profileModules, profileChannel, profileChannels, profileRoleSegments, profileSegmentCapacity } from '../domain/ModbusProfileMetadata';
import type { ModbusAddressProfile, ModbusAddressSegment } from '../domain/ModbusProfileDefinition';

describe('Feature: Semantic profile metadata (AC41)', () => {
  describe.each(['xinje-xl5e-16t-v1', 'xinje-xl5e-16t-v2'])('%s', id => {
    const profile = addressProfile(id);
    it.each([
      ['X0', 20480], ['X1', 20481], ['X7', 20487], ['Y0', 24576], ['Y7', 24583],
      ['M100', 100], ['M101', 101], ['M200', 200], ['D100', 100], ['D110', 110],
      ['X10000', 20736], ['Y10000', 24832],
    ])('Scenario: %s retains PDU %i through profile channel lookup (AC41)', (symbol, pdu) => {
      const point = profile.resolve(symbol);
      expect(profileChannel(profile, point.segment, pdu - point.segment.base)).toEqual(point);
      expect(point.address).toBe(pdu);
    });
    it('Scenario: Classification and role options derive from segments without changing policies (AC41)', () => {
      expect(profileFamilies(profile).find(f => f.familyId === 'X')?.kind).toBe('physical_input');
      expect(profileFamilies(profile).find(f => f.familyId === 'Y')?.kind).toBe('physical_output');
      expect(profileFamilies(profile).find(f => f.familyId === 'M')?.kind).toBe('internal_memory');
      expect(profileFamilies(profile).find(f => f.familyId === 'D')?.kind).toBe('register');
      expect(profile.segments.every(s => s.semantics)).toBe(true);
      expect(profileRoleSegments(profile, 'output').every(s => s.semantics?.kind === 'physical_output')).toBe(true);
      expect(profileRoleSegments(profile, 'setpoint').map(s => s.prefix)).toEqual(id.endsWith('v2') ? ['D', 'HD'] : []);
    });
    it('Scenario: Ordinal eight uses octal formatter and known capacities restrict channels (AC41)', () => {
      const segment = profile.resolve('X0').segment;
      expect(profileChannel(profile, segment, 8).symbolicAddress).toBe('X10');
      expect(profileSegmentCapacity(profile, segment)).toMatchObject({ reservedCount: 64, declaredCount: undefined, capacityKnown: false, radix: 8 });
      const capacities = { CPU: { inputs: 8, outputs: 0 } };
      expect(profileSegmentCapacity(profile, segment, capacities)).toMatchObject({ selectableCount: 8, capacityKnown: true });
      expect(profileChannels(profile, segment, 0, 16, capacities)).toHaveLength(8);
      expect(() => profileChannel(profile, segment, 8, capacities)).toThrow();
      expect(profileChannels(profile, profile.resolve('Y0').segment, 0, 8, capacities)).toEqual([]);
      expect(profileModules(profile)).toHaveLength(17);
      expect(profileModules(profile, capacities)[0].channels[0]).toMatchObject({ familyId: 'X', channel: 'inputs', declaredCount: 8 });
      expect(() => profileModules(profile, { CPU: { inputs: 65, outputs: 0 } })).toThrow();
    });
    it('Scenario: Channel pages reject invalid ordinals and do not alter metadata (AC41)', () => {
      const segment = profile.resolve('D100').segment;
      const before = JSON.stringify(profile.segments);
      expect(profileChannels(profile, segment, 100, 2).map(p => p.symbolicAddress)).toEqual(['D100', 'D101']);
      for (const [start, limit] of [[-1, 1], [0, 0], [0, 65], [0.5, 1]]) expect(() => profileChannels(profile, segment, start, limit)).toThrow();
      expect(() => profileChannel(profile, segment, 0.5)).toThrow();
      expect(() => profileSegmentCapacity(profile, { ...segment })).toThrow();
      expect(JSON.stringify(profile.segments)).toBe(before);
    });
  });

  it('Scenario: Alternative test-only profile owns names radix modules and resolution (AC41)', () => {
    const segment: ModbusAddressSegment = {
      prefix: 'PORT', first: 16, count: 32, base: 300, radix: 16, area: 'discrete_input',
      module: 'rack-alpha', channel: 'inputs', writable: false, supportsPulse: false, supportsSetpoint: false,
      semantics: { familyId: 'contacts', kind: 'physical_input', compatibleRoles: ['input', 'diagnostic'] },
    };
    const profile: ModbusAddressProfile = {
      id: 'test-only', manufacturer: 'Fixture', family: 'Test', model: 'Test', version: 1,
      segments: [segment], booleanBindingAreas: ['discrete_input'], maxRangeLength: 8,
      validateCapacities: value => {
        if (value === undefined) return undefined;
        if (typeof value !== 'object' || value === null || !('rack-alpha' in value)) throw new Error('Invalid rack');
        const capacity = value['rack-alpha'];
        if (typeof capacity !== 'object' || capacity === null || !('inputs' in capacity) || !('outputs' in capacity) || typeof capacity.inputs !== 'number' || !Number.isInteger(capacity.inputs) || capacity.inputs < 0 || capacity.inputs > 32 || capacity.outputs !== 0) throw new Error('Invalid capacity');
        return { 'rack-alpha': { inputs: capacity.inputs, outputs: 0 } };
      },
      format: (s, index) => `${s.prefix}:${index.toString(s.radix).toUpperCase()}`,
      resolve: (symbol, capacities) => {
        if (!/^PORT:[0-9A-F]+$/.test(symbol)) throw new Error('Invalid test symbol');
        const ordinal = Number.parseInt(symbol.slice(5), 16) - segment.first;
        const count = capacities?.['rack-alpha']?.inputs;
        if (ordinal < 0 || ordinal >= (count ?? segment.count)) throw new Error('Outside test capacity');
        return { segment, area: segment.area, address: segment.base + ordinal, symbolicAddress: symbol, physicalCapacityKnown: count !== undefined };
      },
    };
    const format = jest.spyOn(profile, 'format'), resolve = jest.spyOn(profile, 'resolve');
    expect(profileChannel(profile, segment, 10)).toMatchObject({ symbolicAddress: 'PORT:1A', address: 310 });
    expect(format).toHaveBeenCalledWith(segment, 26);
    expect(resolve).toHaveBeenCalledWith('PORT:1A', undefined);
    expect(profileFamilies(profile)[0]).toMatchObject({ familyId: 'contacts', kind: 'physical_input' });
    expect(profileRoleSegments(profile, 'output_command')).toEqual([]);
    expect(profileModules(profile)[0]).toMatchObject({ id: 'rack-alpha', channels: [{ radix: 16, reservedCount: 32, capacityKnown: false }] });
    expect(profileChannels(profile, segment, 0, 8, { 'rack-alpha': { inputs: 3, outputs: 0 } })).toHaveLength(3);
    expect(() => profileChannel(profile, segment, 3, { 'rack-alpha': { inputs: 3, outputs: 0 } })).toThrow();
    expect(() => profileModules(profile, { CPU: { inputs: 3, outputs: 0 } })).toThrow();
  });
  it('Scenario: Definitions without semantic metadata stay usable without guessed families (AC41)', () => {
    const original = addressProfile('xinje-xl5e-16t-v1');
    const profile = { ...original, segments: original.segments.map(({ semantics: _semantics, ...segment }) => segment) };
    expect(profileFamilies(profile)).toEqual([]);
    expect(profileRoleSegments(profile, 'input')).toEqual([]);
    expect(profile.resolve('M100').address).toBe(100);
  });
  it('Scenario: Conflicting classification within a family fails explicitly (AC41)', () => {
    const original = addressProfile('xinje-xl5e-16t-v1');
    const segment = original.resolve('X0').segment;
    expect(() => profileFamilies({ ...original, segments: [segment, { ...segment,
      semantics: { familyId: 'X', kind: 'register', compatibleRoles: ['diagnostic'] },
    }] })).toThrow('Inconsistent family classification');
  });
});
