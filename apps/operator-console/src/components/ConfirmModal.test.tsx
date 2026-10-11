import { renderToStaticMarkup } from 'react-dom/server';
import ConfirmModal from './ConfirmModal';

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

describe('Feature: ConfirmModal confirmation dialog (modular contract C1-C4)', () => {
  it('renders nothing while closed', () => {
    expect(renderToStaticMarkup(<ConfirmModal isOpen={false} onClose={noop} onConfirm={noop} title="t" description="d" />)).toBe('');
  });

  it('shows title, description and the default action labels', () => {
    const html = renderToStaticMarkup(<ConfirmModal isOpen onClose={noop} onConfirm={noop} title="¿Eliminar?" description="No se puede deshacer" />);
    expect(html).toContain('¿Eliminar?');
    expect(html).toContain('No se puede deshacer');
    expect(html).toContain('Confirm');
    expect(html).toContain('Cancel');
  });

  it('uses custom action labels when given', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal isOpen onClose={noop} onConfirm={noop} title="t" description="d" confirmText="Sí, borrar" cancelText="No" />,
    );
    expect(html).toContain('Sí, borrar');
    expect(html).toContain('>No<');
  });

  it('locks the dialog while submitting', () => {
    const idle = renderToStaticMarkup(<ConfirmModal isOpen onClose={noop} onConfirm={noop} title="t" description="d" />);
    const busy = renderToStaticMarkup(<ConfirmModal isOpen isSubmitting onClose={noop} onConfirm={noop} title="t" description="d" />);
    expect(busy).toContain('disabled');
    expect(idle).not.toBe(busy);
  });
});
