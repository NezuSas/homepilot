import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingState } from './LoadingState';
describe('Feature: Initial view skeletons (AC51)', () => {
  it.each(['home', 'cards', 'list'] as const)('announces loading once and hides decorative placeholders for %s', layout => {
    const html = renderToStaticMarkup(<LoadingState label="Cargando" layout={layout} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Cargando"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
  });
});
