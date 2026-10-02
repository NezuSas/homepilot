import { convertModbusValue, modbusWordCount, validateVariable, type ModbusDataType } from '../domain/Modbus';

describe('Feature: Modbus commissioning conversion (AC10)', () => {
  it.each<[ModbusDataType, number[], number]>([['uint16', [65535], 65535], ['int16', [65535], -1], ['uint32', [65535, 65535], 4294967295], ['int32', [65535, 65534], -2], ['float32', [16820, 0], 22.5]])
    ('Scenario: Given %s RAW words When converted Then signedness and precision are preserved', (dataType, words, expected) => {
      expect(convertModbusValue(words, { dataType, wordOrder: 'high_first', scale: 1, offset: 0 })).toBe(expected);
      if (words.length === 2) expect(convertModbusValue([...words].reverse(), { dataType, wordOrder: 'low_first', scale: 1, offset: 0 })).toBe(expected);
    });
  it('Scenario: Given RAW signed input When scaled Then preview equals the driver conversion', () => {
    expect(convertModbusValue([65436], { dataType: 'int16', wordOrder: 'high_first', scale: 0.1, offset: 2 })).toBe(-8);
  });
  it.each<ModbusDataType>(['uint32', 'int32', 'float32'])('Scenario: Given %s at the address limit When configured Then two words must fit', dataType => {
    expect(modbusWordCount(dataType)).toBe(2);
    expect(() => validateVariable({ name: 'V', area: 'holding_register', address: 65535, dataType })).toThrow();
    expect(validateVariable({ name: 'V', area: 'holding_register', address: 65534, dataType }).dataType).toBe(dataType);
    expect(() => convertModbusValue([42], { dataType, wordOrder: 'high_first', scale: 1, offset: 0 })).toThrow();
  });
  it('Scenario: Given non-finite float RAW When decoded Then no fictional value is returned', () => {
    expect(() => convertModbusValue([32704, 0], { dataType: 'float32', wordOrder: 'high_first', scale: 1, offset: 0 })).toThrow();
  });
});
