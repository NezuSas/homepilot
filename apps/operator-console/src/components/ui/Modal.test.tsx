import { renderToStaticMarkup } from 'react-dom/server';
import { Modal } from './Modal';

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

describe('Feature: Modal dialog primitive (modular contract C1-C4)', () => {
  it('renders nothing while closed', () => {
    expect(renderToStaticMarkup(<Modal isOpen={false} title="Título" />)).toBe('');
  });

  it('renders a modal dialog labelled by its title and described by its description', () => {
    const html = renderToStaticMarkup(<Modal isOpen title="Título" description="Detalle">Cuerpo</Modal>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    for (const text of ['Título', 'Detalle', 'Cuerpo']) expect(html).toContain(text);
  });

  it('falls back to an aria-label when there is no title', () => {
    const html = renderToStaticMarkup(<Modal isOpen description="Solo descripción" />);
    expect(html).not.toContain('aria-labelledby');
    expect(html).toContain('aria-label="Solo descripción"');
  });

  it('shows a close button only when it can close, using the given label', () => {
    expect(renderToStaticMarkup(<Modal isOpen title="x" onClose={noop} closeLabel="Cerrar" />)).toContain('Cerrar');
    expect(renderToStaticMarkup(<Modal isOpen title="x" />)).not.toContain('<button');
    expect(renderToStaticMarkup(<Modal isOpen title="x" onClose={noop} hideCloseButton />)).not.toContain('<button');
  });

  it('renders a footer and a variant icon when provided', () => {
    const html = renderToStaticMarkup(<Modal isOpen title="x" variant="danger" footer={<span>Pie</span>} />);
    expect(html).toContain('Pie');
    expect(html).toContain('<svg');
  });

  it('merges class names for the layer, panel, header, body and footer', () => {
    const html = renderToStaticMarkup(
      <Modal isOpen title="x" footer="f" layerClassName="layer-x" className="panel-x" headerClassName="header-x" bodyClassName="body-x" footerClassName="footer-x" />,
    );
    for (const name of ['layer-x', 'panel-x', 'header-x', 'body-x', 'footer-x']) expect(html).toContain(name);
  });
});
