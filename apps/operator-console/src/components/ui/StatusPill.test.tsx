import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill } from './StatusPill';

describe('Feature: StatusPill state primitive (modular contract C1-C4)', () => {
  it('renders a short label', () => {
    expect(renderToStaticMarkup(<StatusPill>Encendida</StatusPill>)).toContain('Encendida');
  });

  it('gives each variant its own treatment', () => {
    const variants = ['neutral', 'success', 'danger', 'warning', 'primary'] as const;
    const markups = variants.map((variant) => renderToStaticMarkup(<StatusPill variant={variant}>x</StatusPill>));
    expect(new Set(markups).size).toBe(variants.length);
  });

  it('animates only when pulsing', () => {
    expect(renderToStaticMarkup(<StatusPill pulse>x</StatusPill>)).toContain('animate-');
    expect(renderToStaticMarkup(<StatusPill>x</StatusPill>)).not.toContain('animate-');
  });

  it('keeps a dot-only pill labelled only when it has an accessible label', () => {
    const labelled = renderToStaticMarkup(<StatusPill dot variant="danger" dotLabel="Sin conexión" />);
    expect(labelled).toContain('Sin conexión');
  });

  it('merges a consumer className and forwards native attributes', () => {
    const html = renderToStaticMarkup(<StatusPill className="extra" data-state="on">x</StatusPill>);
    expect(html).toContain('extra');
    expect(html).toContain('data-state="on"');
  });
});
