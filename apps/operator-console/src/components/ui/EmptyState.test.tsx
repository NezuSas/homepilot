import { renderToStaticMarkup } from 'react-dom/server';
import { Home } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { ScenesEmptyState } from '../ScenesEmptyState';
import { AutomationsEmptyState } from '../AutomationsEmptyState';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('Feature: Reusable collection empty state (AC50)', () => {
  it('announces a collection with decorative icon and no duplicate action', () => {
    const html = renderToStaticMarkup(<EmptyState variant="collection" icon={Home} title="Sin espacios" description="Añade uno desde el encabezado." />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
  });
  it('does not duplicate creation controls in scenes or automations', () => {
    for (const html of [renderToStaticMarkup(<ScenesEmptyState />), renderToStaticMarkup(<AutomationsEmptyState />)]) {
      expect(html).toContain('role="status"');
      expect(html).not.toContain('<button');
    }
  });
  it('preserves optional actions for default consumers', () => {
    expect(renderToStaticMarkup(<EmptyState title="Sin datos" action={<button>Reintentar</button>} />)).toContain('<button>Reintentar</button>');
  });
});
