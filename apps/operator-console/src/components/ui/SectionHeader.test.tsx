import { renderToStaticMarkup } from 'react-dom/server';
import { Home } from 'lucide-react';
import { SectionHeader } from './SectionHeader';

describe('Feature: SectionHeader heading primitive (modular contract C1-C4)', () => {
  it('uses the right semantic element for each level', () => {
    expect(renderToStaticMarkup(<SectionHeader level="view" title="Espacios" />)).toContain('<h1');
    expect(renderToStaticMarkup(<SectionHeader level="section" title="Luces" />)).toContain('<h2');
    const group = renderToStaticMarkup(<SectionHeader level="group" title="Grupo" />);
    expect(group).not.toMatch(/<h[1-6]/);
    expect(group).toContain('Grupo');
  });

  it('renders subtitle, action and icon', () => {
    const html = renderToStaticMarkup(
      <SectionHeader level="section" title="Luces" subtitle="Controla las luces" icon={Home} action={<button type="button">Añadir</button>} />,
    );
    expect(html).toContain('Controla las luces');
    expect(html).toContain('Añadir');
    expect(html).toContain('<svg');
  });

  it('omits optional regions when they are not provided', () => {
    const html = renderToStaticMarkup(<SectionHeader level="section" title="Solo título" />);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<button');
  });
});
