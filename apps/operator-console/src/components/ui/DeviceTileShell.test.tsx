import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceTileShell } from './DeviceTileShell';

const isForwardRef = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');

describe('Feature: DeviceTileShell structural primitive (modular contract C1-C4)', () => {
  it('is static by default and exposes no button semantics', () => {
    const html = renderToStaticMarkup(<DeviceTileShell>Luz</DeviceTileShell>);
    expect(html).toContain('Luz');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('tabindex');
  });

  it('becomes a focusable button when interactive', () => {
    const html = renderToStaticMarkup(<DeviceTileShell interactive>Luz</DeviceTileShell>);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it('reflects activity in its state class', () => {
    expect(renderToStaticMarkup(<DeviceTileShell active>Luz</DeviceTileShell>)).toContain('device-state-on');
    expect(renderToStaticMarkup(<DeviceTileShell>Luz</DeviceTileShell>)).toContain('device-state-off');
  });

  it('is not a button when disabled', () => {
    expect(renderToStaticMarkup(<DeviceTileShell interactive disabled>Luz</DeviceTileShell>)).not.toContain('role="button"');
  });

  it('merges a consumer className, forwards attributes and refs', () => {
    const html = renderToStaticMarkup(<DeviceTileShell className="extra" data-tile="light" aria-label="Luz">x</DeviceTileShell>);
    expect(html).toContain('extra');
    expect(html).toContain('data-tile="light"');
    expect(html).toContain('aria-label="Luz"');
    expect(isForwardRef(DeviceTileShell)).toBe(true);
  });
});
