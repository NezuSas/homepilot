import { renderToStaticMarkup } from 'react-dom/server';
import { HomeDashboardButton } from './HomeDashboardButton';

describe('Home dashboard button', () => {
  it('presents one named action with its dashboard icon, label and direction', () => {
    const html = renderToStaticMarkup(
      <HomeDashboardButton
        label="Ir a tablero"
        accessibleLabel="Abrir la pestaña Principal de mi tablero"
        onActivate={() => {}}
      />,
    );

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Abrir la pestaña Principal de mi tablero"');
    expect(html).toContain('Ir a tablero');
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).not.toContain('disabled=""');
  });

  it('explains an unavailable destination and prevents activation', () => {
    const html = renderToStaticMarkup(
      <HomeDashboardButton
        label="Ir a tablero"
        accessibleLabel="Sin pestaña principal"
        disabled
        onActivate={() => {}}
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('title="Sin pestaña principal"');
    expect(html).toContain('aria-label="Sin pestaña principal"');
  });
});
