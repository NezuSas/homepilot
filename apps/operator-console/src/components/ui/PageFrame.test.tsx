import { renderToStaticMarkup } from 'react-dom/server';
import { PageFrame } from './PageFrame';

describe('Feature: PageFrame view wrapper (modular contract C1-C4)', () => {
  it('renders its children', () => {
    expect(renderToStaticMarkup(<PageFrame>Vista</PageFrame>)).toContain('Vista');
  });

  it('changes its measure with maxWidth and immersive', () => {
    const wide = renderToStaticMarkup(<PageFrame />);
    const standard = renderToStaticMarkup(<PageFrame maxWidth="standard" />);
    const none = renderToStaticMarkup(<PageFrame maxWidth="none" />);
    const immersive = renderToStaticMarkup(<PageFrame immersive />);
    expect(new Set([wide, standard, none]).size).toBe(3);
    expect(immersive).not.toBe(wide);
  });

  it('merges a consumer className and forwards native attributes', () => {
    const html = renderToStaticMarkup(<PageFrame className="extra" data-view="spaces" id="main" />);
    expect(html).toContain('extra');
    expect(html).toContain('data-view="spaces"');
    expect(html).toContain('id="main"');
  });
});
