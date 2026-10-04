import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditableInformationCard, InformationCard, InformationCardSkeleton } from './InformationCard';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { useCuencaWeather } from './clock/useCuencaWeather';
jest.mock('../../../config', () => ({ API_BASE_URL: '' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('./clock/useCuencaWeather', () => ({ useCuencaWeather: jest.fn() }));

describe('Feature: Independent dashboard information badges (AC48)', () => {
  beforeEach(() => {
    jest.mocked(useCuencaWeather).mockReturnValue({ weather: null, status: 'loading' });
  });
  it('Scenario: Weather pill keeps one configured icon and a single-line reading (AC55)', () => {
    jest.mocked(useCuencaWeather).mockReturnValue({ status: 'ready', weather: {
      temperature: 19, code: 0, windSpeed: 0, updatedAt: '2026-10-04T12:00', location: 'Cuenca', label: 'Despejado',
    } });
    const html = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_weather', title: 'Weather', pill: true, icon: 'Battery' }));
    expect(html).toContain('19°C');
    expect(html).toContain('Despejado');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('truncate');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('lucide-battery');
    const automatic = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_weather', title: 'Weather', pill: true }));
    expect(automatic.match(/<svg/g)).toHaveLength(1);
    expect(automatic).toContain('viewBox="0 0 64 64"');
  });
  it('Scenario: Pending weather pill has no duplicate icon skeleton (AC55)', () => {
    const html = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_weather', title: 'Weather', pill: true }));
    expect(html.match(/animate-pulse/g)).toHaveLength(1);
    expect(html.match(/<svg/g)).toHaveLength(1);
  });
  it('Scenario: Only edit mode exposes an explicit pencil, not an Edit text action (AC55)', () => {
    const render = (isEditing: boolean) => renderToStaticMarkup(React.createElement(EditableInformationCard, { isEditing, onEdit: () => {}, children: 'Reading' }));
    expect(render(false)).not.toContain('<button');
    expect(render(true)).toContain('lucide-pencil');
    expect(render(true)).toContain('aria-label="common.edit"');
    expect(render(true)).not.toContain('>common.edit<');
  });
  it('Scenario: Sensor readings and missing readings are read-only and share the sensor model', () => {
    const device: SnapshotDevice = { id: 's', name: 'Temperature', type: 'sensor', roomId: 'room', homeId: 'home', status: 'ASSIGNED', lastKnownState: { value: 22.345, unit_of_measurement: '°C' } };
    const html = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_sensor', device, title: 'Temperature' }));
    expect(html).toContain('22.35');
    expect(html).toContain('°C');
    expect(html).not.toContain('<button');
    const missing = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_sensor', title: 'Temperature' }));
    expect(missing).toContain('information_unavailable');
  });
  it('Scenario: Label row reuses the hero indicator without commands', () => {
    const html = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_sensor', title: 'Temperature', pill: true }));
    expect(html).toContain('dashboard-context-chip');
    expect(html).toContain('information_unavailable');
    expect(html).not.toContain('<button');
  });
  it('Scenario: All pill sources respect the configured dashboard icon (AC55)', () => {
    for (const source of ['info_time', 'info_weather', 'info_sensor'] as const) {
      const html = renderToStaticMarkup(React.createElement(InformationCard, { source, title: 'Reading', pill: true, icon: 'Battery' }));
      expect(html).toContain('lucide-battery');
      expect(html).not.toContain('<button');
    }
  });
  it('Scenario: Time and pending weather render without decorative actions', () => {
    const time = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_time', title: 'Time' }));
    expect(time).toMatch(/\d{2}:\d{2}/);
    expect(time).not.toContain('<button');
    const weather = renderToStaticMarkup(React.createElement(InformationCard, { source: 'info_weather', title: 'Weather' }));
    expect(weather).toContain('animate-pulse');
    expect(renderToStaticMarkup(React.createElement(InformationCardSkeleton))).toContain('aria-hidden="true"');
  });
});
