import { renderToStaticMarkup } from 'react-dom/server';
import { Drawer } from './Drawer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: unknown) => node,
}));

const noop = () => undefined;

beforeAll(() => {
  Object.defineProperty(globalThis, 'document', { value: { body: {} }, configurable: true });
});
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('Feature: Drawer side panel primitive (modular contract C1-C4)', () => {
  it('renders nothing while closed', () => {
    expect(renderToStaticMarkup(<Drawer isOpen={false}>Cuerpo</Drawer>)).toBe('');
  });

  it('renders a modal dialog with its children', () => {
    const html = renderToStaticMarkup(<Drawer isOpen ariaLabel="Detalle">Cuerpo</Drawer>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Detalle"');
    expect(html).toContain('Cuerpo');
  });

  it('exposes title and description to assistive tech through the dialog relations', () => {
    const html = renderToStaticMarkup(<Drawer isOpen title="Título" description="Detalle">x</Drawer>);
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    expect(html).not.toContain('aria-label=');
    expect(html).toContain('Título');
    expect(html).toContain('Detalle');
  });

  it('shows a close button only when it can close, using the given label', () => {
    expect(renderToStaticMarkup(<Drawer isOpen onClose={noop} closeLabel="Cerrar">x</Drawer>)).toContain('Cerrar');
    expect(renderToStaticMarkup(<Drawer isOpen>x</Drawer>)).not.toContain('<button');
    expect(renderToStaticMarkup(<Drawer isOpen onClose={noop} hideCloseButton>x</Drawer>)).not.toContain('<button');
  });

  it('merges class names for the layer, panel and backdrop', () => {
    const html = renderToStaticMarkup(<Drawer isOpen layerClassName="layer-x" panelClassName="panel-x" backdropClassName="backdrop-x">x</Drawer>);
    for (const name of ['layer-x', 'panel-x', 'backdrop-x']) expect(html).toContain(name);
  });
});
