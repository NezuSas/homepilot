import { renderToStaticMarkup } from 'react-dom/server';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

const isForwardRef = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');

describe('Feature: Card surface primitive (modular contract C1-C4)', () => {
  it('renders its children and merges a consumer className', () => {
    const html = renderToStaticMarkup(<Card className="custom-surface">Contenido</Card>);
    expect(html).toContain('Contenido');
    expect(html).toContain('custom-surface');
  });

  it('maps every variant to a distinct treatment', () => {
    const variants = ['default', 'elevated', 'glass', 'error', 'active'] as const;
    const markups = variants.map((variant) => renderToStaticMarkup(<Card variant={variant} />));
    expect(new Set(markups).size).toBe(variants.length);
  });

  it('forwards native attributes and accessible names', () => {
    const html = renderToStaticMarkup(<Card role="group" aria-label="Resumen" data-testid="card" />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Resumen"');
    expect(html).toContain('data-testid="card"');
  });

  it('forwards refs on every part', () => {
    for (const part of [Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter]) {
      expect(isForwardRef(part)).toBe(true);
    }
  });

  it('composes header, title, description, content and footer', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Título</CardTitle>
          <CardDescription>Detalle</CardDescription>
        </CardHeader>
        <CardContent>Cuerpo</CardContent>
        <CardFooter>Pie</CardFooter>
      </Card>,
    );
    for (const text of ['Título', 'Detalle', 'Cuerpo', 'Pie']) expect(html).toContain(text);
  });
});
