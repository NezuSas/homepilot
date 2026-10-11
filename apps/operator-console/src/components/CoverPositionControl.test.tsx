import { renderToStaticMarkup } from 'react-dom/server';
import { CoverPositionControl } from './CoverPositionControl';

const noop = () => undefined;

describe('Feature: CoverPositionControl slider (modular contract C1-C4)', () => {
  it('renders a 0-100 range named by ariaLabel with the initial position', () => {
    const html = renderToStaticMarkup(<CoverPositionControl ariaLabel="Posición de la cortina" initialPosition={35} onPositionChange={noop} />);
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('value="35"');
    expect(html).toContain('aria-label="Posición de la cortina"');
  });

  it('shows the bounds and value as percentages', () => {
    const html = renderToStaticMarkup(<CoverPositionControl ariaLabel="x" initialPosition={35} onPositionChange={noop} />);
    for (const text of ['0%', '35%', '100%']) expect(html).toContain(text);
  });

  it('starts closed by default and can be disabled', () => {
    expect(renderToStaticMarkup(<CoverPositionControl ariaLabel="x" onPositionChange={noop} />)).toContain('value="0"');
    expect(renderToStaticMarkup(<CoverPositionControl ariaLabel="x" disabled onPositionChange={noop} />)).toContain('disabled');
  });
});
