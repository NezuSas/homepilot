import { renderToStaticMarkup } from 'react-dom/server';
import { Home } from 'lucide-react';
import { SidebarItem } from './SidebarItem';

describe('Feature: SidebarItem navigation primitive (modular contract C1-C4)', () => {
  it('renders an enabled button with its label and icon', () => {
    const html = renderToStaticMarkup(<SidebarItem icon={Home} label="Inicio" />);
    expect(html).toContain('<button');
    expect(html).toContain('Inicio');
    expect(html).toContain('<svg');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('aria-current');
  });

  it('marks the active item as the current page', () => {
    expect(renderToStaticMarkup(<SidebarItem icon={Home} label="Inicio" active />)).toContain('aria-current="page"');
  });

  it('disables an item that carries a coming-soon tag and shows the tag', () => {
    const html = renderToStaticMarkup(<SidebarItem icon={Home} label="Energía" soonText="Pronto" />);
    expect(html).toContain('disabled');
    expect(html).toContain('Pronto');
  });

  it('shows a badge', () => {
    expect(renderToStaticMarkup(<SidebarItem icon={Home} label="Tableros" badge={<span>3</span>} nested />)).toContain('<span>3</span>');
  });

  it('exposes the label as a title when collapsed on desktop', () => {
    expect(renderToStaticMarkup(<SidebarItem icon={Home} label="Inicio" collapsedOnDesktop />)).toContain('title="Inicio"');
  });

  it('merges a consumer className and forwards native attributes', () => {
    const html = renderToStaticMarkup(<SidebarItem icon={Home} label="Inicio" className="extra" data-nav="home" />);
    expect(html).toContain('extra');
    expect(html).toContain('data-nav="home"');
  });
});
