import { renderToStaticMarkup } from 'react-dom/server';
import { AlertBanner } from './AlertBanner';

describe('Feature: AlertBanner feedback primitive (modular contract C1-C4)', () => {
  it('announces urgent variants as alerts and passive ones as status', () => {
    expect(renderToStaticMarkup(<AlertBanner variant="danger" message="Falló" />)).toContain('role="alert"');
    expect(renderToStaticMarkup(<AlertBanner variant="warning" message="Aviso" />)).toContain('role="alert"');
    expect(renderToStaticMarkup(<AlertBanner variant="success" message="Hecho" />)).toContain('role="status"');
    expect(renderToStaticMarkup(<AlertBanner message="Info" />)).toContain('role="status"');
  });

  it('labels the region by its title and describes it by its message', () => {
    const html = renderToStaticMarkup(<AlertBanner title="Sin conexión" message="Reintentando" />);
    expect(html).toContain('Sin conexión');
    expect(html).toContain('Reintentando');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it('does not reference a title it does not render', () => {
    expect(renderToStaticMarkup(<AlertBanner message="Solo mensaje" />)).not.toContain('aria-labelledby');
  });

  it('renders an optional action', () => {
    const html = renderToStaticMarkup(<AlertBanner variant="danger" message="x" action={<button type="button">Reintentar</button>} />);
    expect(html).toContain('Reintentar');
  });

  it('merges a consumer className', () => {
    expect(renderToStaticMarkup(<AlertBanner message="x" className="extra" />)).toContain('extra');
  });
});
