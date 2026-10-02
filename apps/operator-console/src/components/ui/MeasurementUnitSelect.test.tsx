import { renderToStaticMarkup } from 'react-dom/server';
import { MeasurementUnitSelect, measurementUnits } from './MeasurementUnitSelect';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'modbus.no_unit' ? 'Sin unidad' : key }) }));

describe('Measurement units (AC17/AC80)', () => {
  it('offers common units and a unique no-unit option', () => {
    expect(new Set(measurementUnits).size).toBe(measurementUnits.length);
    expect(measurementUnits).toEqual(expect.arrayContaining(['', '%', '°C', 'bar', 'hPa', 'V', 'kWh', 'ppm', 'GB']));
    expect(renderToStaticMarkup(<MeasurementUnitSelect value="" onChange={() => {}} />)).toContain('Sin unidad');
  });
  it('preserves an unknown historical unit without rewriting it', () => {
    expect(renderToStaticMarkup(<MeasurementUnitSelect value="custom/min" onChange={() => {}} />)).toContain('custom/min');
  });
});
