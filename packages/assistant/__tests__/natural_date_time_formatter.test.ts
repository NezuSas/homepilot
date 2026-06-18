import {
  formatNaturalSpanishTime,
  getSpanishDayPeriod
} from '../application/NaturalDateTimeFormatter';

describe('NaturalDateTimeFormatter', () => {
  it('speaks a morning time naturally', () => {
    const date = new Date('2026-06-17T14:45:00.000Z');
    expect(formatNaturalSpanishTime(date, 'America/Guayaquil')).toBe('Son las nueve y cuarenta y cinco de la mañana');
  });

  it('uses singular wording at one o clock', () => {
    const date = new Date('2026-06-17T18:00:00.000Z');
    expect(formatNaturalSpanishTime(date, 'America/Guayaquil')).toBe('Es la una en punto de la tarde');
  });

  it('classifies all residential day periods', () => {
    expect(getSpanishDayPeriod(2)).toBe('madrugada');
    expect(getSpanishDayPeriod(9)).toBe('mañana');
    expect(getSpanishDayPeriod(15)).toBe('tarde');
    expect(getSpanishDayPeriod(22)).toBe('noche');
  });
});
