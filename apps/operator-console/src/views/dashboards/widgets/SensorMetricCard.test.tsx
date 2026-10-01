import { renderToStaticMarkup } from 'react-dom/server';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getSensorReading, getSensorSeverity, SensorMetricCard } from './SensorMetricCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'dashboard.editor.sections.sensor_battery': 'Batería',
  'dashboard.editor.sections.sensor_battery_level': 'Nivel de batería',
  'dashboard.editor.sections.sensor_temperature': 'Temperatura',
  'dashboard.editor.sections.sensor_gpu_temperature': 'Temperatura GPU',
  'dashboard.editor.sections.sensor_load': 'Carga',
  'dashboard.editor.sections.sensor_cpu_load': 'Carga de CPU',
  'dashboard.editor.sections.sensor_gpu_load': 'Carga de GPU',
  'dashboard.editor.sections.sensor_memory_usage': 'Uso de memoria',
  'dashboard.editor.sections.sensor_memory_low': 'Uso elevado',
  'dashboard.editor.sections.sensor_memory_critical': 'Uso crítico',
  'dashboard.editor.sections.sensor_status': 'Estado',
  'dashboard.editor.sections.sensor_normal': 'Normal',
  'dashboard.editor.sections.sensor_low': 'Bajo',
  'dashboard.editor.sections.sensor_critical': 'Crítico',
  'dashboard.editor.sections.sensor_unavailable': 'Sin lectura',
  'dashboard.editor.sections.sensor_open': 'Abierto',
  'dashboard.editor.sections.sensor_active': 'Activo',
  'dashboard.editor.sections.sensor_on': 'Encendido',
  'dashboard.editor.sections.sensor_off': 'Apagado',
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
    if (value !== '—') expect(html).toContain('role="meter"');
  });

  it('supports temperature, binary and long names without assuming a percentage', () => {
    const temperature = sensor('Temperatura Sala', { state: '22.4', unit_of_measurement: '°C' });
    const binary = sensor('Puerta principal', { state: 'open' });
    const longName = 'Sensor de calidad de aire de la habitación principal';
    const longCard = renderToStaticMarkup(<SensorMetricCard title={longName} device={sensor(longName, { state: '320', unit_of_measurement: 'W' })} />);
    expect(renderToStaticMarkup(<SensorMetricCard title={temperature.name} device={temperature} />)).toContain('22.4');
    expect(renderToStaticMarkup(<SensorMetricCard title={binary.name} device={binary} />)).toContain('Abierto');
    expect(longCard).toContain(longName);
    expect(getSensorSeverity(getSensorReading(temperature))).toBe('informational');
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
    expect(html).toContain(value === 'on' ? 'Encendido' : value);
    if (unit) expect(html).toContain(unit);
  });

  it.each([
    ['Batería', 'battery', '78'],
    ['Carga CPU', 'cpu', '63'],
    ['Carga GPU', 'gpu', '82'],
    ['Memoria', 'memory', '47'],
  ])('shows %s as a circular percentage meter', (name, deviceClass, value) => {
    const device = sensor(name, { state: value, unit_of_measurement: '%', attributes: { device_class: deviceClass } });
    const reading = getSensorReading(device);
    const html = renderToStaticMarkup(<SensorMetricCard title={name} device={device} />);
    expect(reading.presentation).toBe('percentage');
    expect(html).toContain('role="meter"');
    expect(html).toContain(`aria-valuenow="${value}"`);
    expect(html).toContain(`aria-valuetext="${value}%"`);
    expect(html).toContain('stroke-linecap="round"');
    expect(html.replace(/<[^>]*>/g, '')).toContain(name);
    expect(html).not.toContain('Nivel de batería');
    expect(html).not.toContain('Uso de memoria');
  });

  it('shows GPU temperature without a percentage meter or invented range', () => {
    const device = sensor('Temperatura GPU', { state: '63', unit_of_measurement: '°C', attributes: { device_class: 'gpu' } });
    const reading = getSensorReading(device);
    const html = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} />);
    expect(reading.presentation).toBe('temperature');
    expect(html).toContain('63');
    expect(html).toContain('°C');
    expect(html).toContain('Temperatura GPU');
    expect(html).not.toContain('role="meter"');
    expect(getSensorSeverity(reading)).toBe('informational');
  });

  it.each([
    ['on', 'Encendido'],
    ['off', 'Apagado'],
  ])('shows %s as a non-interactive binary reading', (state, label) => {
    const device = sensor('TV Oficina', { state, attributes: { device_class: 'connectivity' } });
    const html = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} icon="mdi:television" />);
    expect(getSensorReading(device).presentation).toBe('binary');
    expect(html).toContain(label);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="meter"');
  });

  it('keeps a categorical state prominent without a gauge', () => {
    const device = sensor('Estado de materia', { state: 'Líquido' });
    const html = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} />);
    expect(getSensorReading(device).presentation).toBe('categorical');
    expect(html).toContain('Líquido');
    expect(html).not.toContain('role="meter"');
  });

  it('shows an unbounded numeric reading and its unit without a gauge', () => {
    const device = sensor('Potencia', { state: '1240', unit_of_measurement: 'W', attributes: { device_class: 'power' } });
    const html = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} />);
    expect(getSensorReading(device).presentation).toBe('numeric');
    expect(html).toContain('1240');
    expect(html).toContain('W');
    expect(html).not.toContain('role="meter"');
  });

  it('uses the same presentation for a bound sensor and its preview', () => {
    const device = sensor('Batería', { state: '78', unit_of_measurement: '%', attributes: { device_class: 'battery' } });
    const live = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} />);
    const preview = renderToStaticMarkup(<SensorMetricCard title={device.name} device={device} isPreview />);
    expect(preview).toBe(live);
  });

  it('prioritizes the configured title and shows the temperature icon only once', () => {
    const device = sensor('Nombre técnico del dispositivo', { state: '22.4', unit_of_measurement: '°C' });
    const html = renderToStaticMarkup(<SensorMetricCard title="Sala principal" device={device} />);
    const text = html.replace(/<[^>]*>/g, '');
    expect(text.match(/Sala principal/g)).toHaveLength(1);
    expect(text).not.toContain(device.name);
    expect(text).not.toContain('Temperatura');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(text).toContain('22.4');
    expect(text).toContain('°C');
    expect(text).not.toContain('Lectura en vivo');
  });

  it.each([
    ['battery', '%', 'unavailable'],
    ['temperature', '°C', 'unknown'],
    ['cpu', '%', 'offline'],
    ['memory', '%', ''],
  ])('keeps unavailable %s readings explicit without a fake measurement', (deviceClass, unit, state) => {
    const html = renderToStaticMarkup(<SensorMetricCard title="Mi sensor" device={sensor('Device', { state, unit_of_measurement: unit, device_class: deviceClass })} />);
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('Mi sensor');
    expect(text).toContain('—');
    expect(text.match(/Sin lectura/g)).toHaveLength(1);
    expect(text).not.toContain(unit);
    expect(text).not.toContain('Normal');
    expect(html).not.toContain('role="meter"');
  });

  it('distinguishes a valid zero percentage from no reading', () => {
    const html = renderToStaticMarkup(<SensorMetricCard title="Batería" device={sensor('Device', { state: '0', unit_of_measurement: '%', device_class: 'battery' })} />);
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('aria-valuetext="0%"');
    expect(html).not.toContain('Sin lectura');
  });

  it.each([['70', 'Uso elevado'], ['90', 'Uso crítico']])('describes %s percent memory as %s rather than a low reading', (value, status) => {
    const html = renderToStaticMarkup(<SensorMetricCard title="RAM" device={sensor('Device', { state: value, unit_of_measurement: '%', device_class: 'memory' })} />);
    expect(html).toContain(status);
    expect(html.replace(/<[^>]*>/g, '')).not.toContain('Bajo');
  });

  it('shows a binary state only once', () => {
    const html = renderToStaticMarkup(<SensorMetricCard title="Conexión" device={sensor('Device', { state: 'on', device_class: 'connectivity' })} />);
    expect(html.replace(/<[^>]*>/g, '').match(/Encendido/g)).toHaveLength(1);
  });

  it.each(['22.4', '-12.5', '0', '100', '123456.7'])('preserves the accessible numeric reading %s without fictional history', (value) => {
    const html = renderToStaticMarkup(<SensorMetricCard title="Medición" device={sensor('Device', { state: value, unit_of_measurement: 'W' })} />);
    expect(html.replace(/<[^>]*>/g, '')).toContain(value);
    if (value.replace(/\D/g, '').length <= 5) expect(html).toContain(`role="img" aria-label="${value}"`);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="meter"');
    expect(html).not.toContain('months');
  });
});
