import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingState } from './LoadingState';
describe('Feature: Initial view skeletons (AC51)', () => {
  it('announces loading once and hides the component-owned decorative content', () => {
    const html = renderToStaticMarkup(<LoadingState label="Cargando"><span>Component placeholder</span></LoadingState>);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Cargando"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
    expect(html).toContain('Component placeholder');
  });
});
