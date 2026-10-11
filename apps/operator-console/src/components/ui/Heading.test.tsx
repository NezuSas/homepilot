import { renderToStaticMarkup } from 'react-dom/server';
import { Heading } from './Heading';

const isForwardRef = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');

describe('Feature: Heading text-style primitive (pattern adoption V1)', () => {
  it('uses the semantic element that fits each variant', () => {
    expect(renderToStaticMarkup(<Heading variant="view">Título</Heading>)).toMatch(/^<h1/);
    expect(renderToStaticMarkup(<Heading variant="section">Título</Heading>)).toMatch(/^<h2/);
    expect(renderToStaticMarkup(<Heading variant="card">Título</Heading>)).toMatch(/^<h3/);
    expect(renderToStaticMarkup(<Heading variant="item">Título</Heading>)).toMatch(/^<h3/);
    expect(renderToStaticMarkup(<Heading variant="label">Título</Heading>)).toMatch(/^<span/);
  });

  it('defaults to the section style', () => {
    expect(renderToStaticMarkup(<Heading>Título</Heading>)).toMatch(/^<h2/);
  });

  it('changes the element without changing the visual style', () => {
    const asH4 = renderToStaticMarkup(<Heading variant="card" as="h4">Título</Heading>);
    const asH3 = renderToStaticMarkup(<Heading variant="card">Título</Heading>);
    expect(asH4).toMatch(/^<h4/);
    expect(asH4.replace(/h4/g, 'h3')).toBe(asH3);
  });

  it('gives every variant its own typography', () => {
    const variants = ['view', 'section', 'card', 'item', 'label'] as const;
    const classes = variants.map((variant) => renderToStaticMarkup(<Heading variant={variant}>x</Heading>).match(/class="([^"]*)"/)?.[1]);
    expect(new Set(classes).size).toBe(variants.length);
    for (const value of classes) expect(value).toContain('break-words');
  });

  it('merges a consumer className, forwards attributes and refs', () => {
    const html = renderToStaticMarkup(<Heading className="extra" id="titulo" data-test="h">Título</Heading>);
    expect(html).toContain('extra');
    expect(html).toContain('id="titulo"');
    expect(html).toContain('data-test="h"');
    expect(isForwardRef(Heading)).toBe(true);
  });
});
