import { renderToStaticMarkup } from 'react-dom/server';
import { AudioInputPicker } from './AudioInputPicker';

const noop = () => undefined;
const devices = [
  { id: 'a', label: 'Default - Micrófono (USB Audio)' },
  { id: 'b', label: 'Headset Microphone' },
];

describe('Feature: AudioInputPicker device selector (modular contract C1-C4)', () => {
  it('renders nothing when there is nothing to choose from', () => {
    expect(renderToStaticMarkup(<AudioInputPicker devices={[]} selectedDeviceId="" label="Entrada" onChange={noop} />)).toBe('');
    expect(renderToStaticMarkup(<AudioInputPicker devices={[devices[0]]} selectedDeviceId="a" label="Entrada" onChange={noop} />)).toBe('');
  });

  it('renders a collapsed listbox trigger named by its label', () => {
    const html = renderToStaticMarkup(<AudioInputPicker devices={devices} selectedDeviceId="b" label="Entrada de audio" onChange={noop} />);
    expect(html).toContain('aria-label="Entrada de audio"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="listbox"');
  });

  it('shows the selected device with a cleaned-up label', () => {
    const html = renderToStaticMarkup(<AudioInputPicker devices={devices} selectedDeviceId="a" label="Entrada" onChange={noop} />);
    expect(html).toContain('USB');
    expect(html).not.toContain('Micrófono');
  });

  it('falls back to the first device when the selection is unknown and can be disabled', () => {
    const html = renderToStaticMarkup(<AudioInputPicker devices={devices} selectedDeviceId="zzz" label="Entrada" disabled onChange={noop} />);
    expect(html).toContain('USB');
    expect(html).toContain('disabled');
  });
});
