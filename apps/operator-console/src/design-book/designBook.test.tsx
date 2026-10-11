import { renderToStaticMarkup } from 'react-dom/server';
import { designBookDemos } from './demos';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }));
// ComponentSkeletons imports feature skeletons that pull in Vite-only stores; the demos use none of them.
jest.mock('../components/ModbusConnectionCard', () => ({ ModbusSettingsSkeleton: () => null }));
jest.mock('../components/EventFilters', () => ({ EventFiltersSkeleton: () => null }));
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: unknown) => node,
}));

beforeAll(() => {
  Object.defineProperty(globalThis, 'document', { value: { body: {} }, configurable: true });
});
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('Feature: Design book gallery (design book V1)', () => {
  const entries = Object.entries(designBookDemos);

  it('registers a demo for each shared component', () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it.each(entries)('renders the %s demo without throwing', (_name, demo) => {
    const html = renderToStaticMarkup(<>{demo.render()}</>);
    expect(html.length).toBeGreaterThan(0);
  });

  it('opens a layer only from a demo that declares a viewport capture', () => {
    for (const [name, demo] of entries) {
      if (demo.openSelector) expect([name, demo.capture]).toEqual([name, 'viewport']);
    }
    expect(['Modal', 'Drawer'].map(name => designBookDemos[name].capture)).toEqual(['viewport', 'viewport']);
  });
});
