import { renderToStaticMarkup } from 'react-dom/server';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getSensorReading, getSensorSeverity, SensorMetricCard } from './SensorMetricCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'dashboard.editor.sections.sensor_battery': 'Batería',
  'dashboard.editor.sections.sensor_temperature': 'Temperatura',
  'dashboard.editor.sections.sensor_status': 'Estado',
  'dashboard.editor.sections.sensor_normal': 'Normal',
  'dashboard.editor.sections.sensor_low': 'Bajo',
  'dashboard.editor.sections.sensor_critical': 'Crítico',
  'dashboard.editor.sections.sensor_unavailable': 'Sin lectura',
  'dashboard.editor.sections.sensor_open': 'Abierto',
  'dashboard.editor.sections.sensor_active': 'Activo',
} as Record<string, string>)[key] ?? key }) }));

function sensor(name: string, state: Record<string, unknown>): SnapshotDevice {
  return { id: name, homeId: 'home', roomId: null, name, type: 'sensor', status: 'ASSIGNED', lastKnownState: state };
}

describe('Sensor Metric Card status presentation', () => {
  it.each([
    { name: 'Batería iPad', state: { state: '60', unit_of_measurement: '%' }, value: '60', status: 'Normal' },
    { name: 'Batería baja', state: { state: '35', unit_of_measurement: '%' }, value: '35', status: 'Bajo' },
    { name: 'Batería crítica', state: { state: '10', unit_of_measurement: '%' }, value: '10', status: 'Crítico' },
    { name: 'Batería sin conexión', state: { state: 'unavailable', unit_of_measurement: '%' }, value: '—', status: 'Sin lectura' },
  ])('renders $name as information, not an action', ({ name, state, value, status }) => {
    const html = renderToStaticMarkup(<SensorMetricCard title={name} device={sensor(name, state)} />);
    expect(html).toContain(value);
    expect(html).toContain(status);
    expect(html).toContain(name);
    expect(html).not.toContain('LISTO');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('sensor-reading-ring');
  });

  it('supports temperature, binary and long names without assuming a percentage', () => {
    const temperature = sensor('Temperatura Sala', { state: '22.4', unit_of_measurement: '°C' });
    const binary = sensor('Puerta principal', { state: 'open' });
    const longName = 'Sensor de calidad de aire de la habitación principal';
    const longCard = renderToStaticMarkup(<SensorMetricCard title={longName} device={sensor(longName, { state: '320', unit_of_measurement: 'W' })} />);
    expect(renderToStaticMarkup(<SensorMetricCard title={temperature.name} device={temperature} />)).toContain('22.4');
    expect(renderToStaticMarkup(<SensorMetricCard title={binary.name} device={binary} />)).toContain('Abierto');
    expect(longCard).toContain(longName);
    expect(longCard).toContain('line-clamp-2');
    expect(getSensorSeverity(getSensorReading(temperature))).toBe('normal');
    expect(getSensorReading(binary).percentage).toBeNull();
  });

  it.each([
    ['Humedad', '45', '%'],
    ['Iluminación exterior', '250', 'lx'],
    ['Consumo actual', '320', 'W'],
    ['Energía diaria', '1.8', 'kWh'],
    ['Calidad de aire', '850', 'ppm'],
    ['Presencia sala', 'on', ''],
    ['Estado corto', 'Reposo', ''],
  ])('keeps the $name reading visible', (name, value, unit) => {
    const html = renderToStaticMarkup(<SensorMetricCard title={name} device={sensor(name, { state: value, unit_of_measurement: unit })} />);
    expect(html).toContain(name);
    expect(html).toContain(value === 'on' ? 'Activo' : value);
    if (unit) expect(html).toContain(unit);
  });
});
