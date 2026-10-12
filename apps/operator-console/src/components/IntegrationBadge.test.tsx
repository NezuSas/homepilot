import { renderToStaticMarkup } from 'react-dom/server';
import { IntegrationBadge } from './IntegrationBadge';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('Feature: integration badge', () => {
  it.each([
    ['ha', 'Home Assistant', 'bridge'],
    ['sonoff', 'Sonoff', 'local_network'],
    ['modbus-tcp', 'Modbus TCP', 'plc'],
    ['native-camera', 'Cámara IP', 'camera'],
    ['android-display', 'Android', 'display'],
  ])('Scenario: Given the source %s When shown Then it names %s and its kind %s without an image', (source, name, kind) => {
    const html = renderToStaticMarkup(<IntegrationBadge source={source} />);
    expect(html).toContain(name);
    expect(html).toContain(`integrations.kinds.${kind}`);
    expect(html).not.toContain('<img');
  });

  it('Scenario: Given a source the catalog does not know When shown Then the raw id is kept so nothing is hidden', () => {
    expect(renderToStaticMarkup(<IntegrationBadge source="future-protocol" />)).toContain('future-protocol');
  });

  it('Scenario: Given no source When shown Then nothing is drawn', () => {
    expect(renderToStaticMarkup(<IntegrationBadge source={undefined} />)).toBe('');
  });
});
