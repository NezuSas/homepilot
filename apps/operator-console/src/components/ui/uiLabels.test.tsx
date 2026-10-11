import { renderToStaticMarkup } from 'react-dom/server';
import { SearchFilterBar } from './SearchFilterBar';
import { UiLabelsContext, defaultUiLabels } from './uiLabels';

const noop = () => undefined;
const bar = <SearchFilterBar searchQuery="x" onSearchChange={noop} />;

describe('Feature: primitive labels without i18n (modular contract C3)', () => {
  it('falls back to English defaults without a provider', () => {
    const html = renderToStaticMarkup(bar);
    expect(html).toContain(`aria-label="${defaultUiLabels.clearSearch}"`);
    expect(html).toContain(`placeholder="${defaultUiLabels.search}"`);
  });

  it('uses the labels supplied by the app root', () => {
    const html = renderToStaticMarkup(
      <UiLabelsContext.Provider value={{ ...defaultUiLabels, search: 'Buscar', clearSearch: 'Borrar búsqueda' }}>{bar}</UiLabelsContext.Provider>,
    );
    expect(html).toContain('aria-label="Borrar búsqueda"');
    expect(html).toContain('placeholder="Buscar"');
  });

  it('lets an explicit prop win over the context', () => {
    const html = renderToStaticMarkup(
      <UiLabelsContext.Provider value={{ ...defaultUiLabels, search: 'Buscar' }}>
        <SearchFilterBar searchQuery="" onSearchChange={noop} searchPlaceholder="Filtrar" />
      </UiLabelsContext.Provider>,
    );
    expect(html).toContain('placeholder="Filtrar"');
  });
});
