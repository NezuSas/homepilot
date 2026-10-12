import { integrationInfo, isPlcIntegration } from '../domain/integrationCatalog';

describe('Feature: integration catalog', () => {
  it.each([
    ['ha', 'Home Assistant', 'bridge'],
    ['home-assistant', 'Home Assistant', 'bridge'],
    ['sonoff', 'Sonoff', 'local_network'],
    ['native-camera', 'Cámara IP', 'camera'],
    ['modbus-tcp', 'Modbus TCP', 'plc'],
    ['android-display', 'Android', 'display'],
  ] as const)('Scenario: Given the source %s When looked up Then it is %s of kind %s', (source, name, kind) => {
    expect(integrationInfo(source)).toMatchObject({ name, kind });
  });

  it.each([[undefined], [null], [''], ['tuya-unknown']])('Scenario: Given %p When looked up Then nothing is claimed about it', (source) => {
    expect(integrationInfo(source)).toBeNull();
  });

  it('Scenario: Given the sources When asked which are PLC Then only the PLC kind answers yes', () => {
    expect(isPlcIntegration('modbus-tcp')).toBe(true);
    expect(['ha', 'sonoff', 'native-camera', 'android-display', undefined, 'x'].some(source => isPlcIntegration(source))).toBe(false);
  });
});
