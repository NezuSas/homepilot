import { MASKED_SECRET, maskStreamPathSecrets, restoreMaskedStreamPathSecrets } from '../application/streamPathSecrets';

describe('Feature: credentials inside a camera stream path never reach the browser', () => {
  it('Scenario: Given a path with username and password When it is masked Then both values are replaced and the rest is kept', () => {
    expect(maskStreamPathSecrets('/stream0?username=admin&password=hunter2&channel=1'))
      .toBe(`/stream0?username=${MASKED_SECRET}&password=${MASKED_SECRET}&channel=1`);
  });

  it.each(['user', 'usr', 'login', 'pass', 'passwd', 'pwd', 'token', 'access_token', 'apikey', 'key', 'secret', 'auth', 'sig', 'signature', 'PASSWORD'])(
    'Scenario: Given the %s parameter When the path is masked Then its value is hidden', (name) => {
      expect(maskStreamPathSecrets(`/live?${name}=abc123`)).toBe(`/live?${name}=${MASKED_SECRET}`);
    });

  it('Scenario: Given a path without credentials When it is masked Then it is returned unchanged', () => {
    for (const path of ['/Streaming/Channels/102', '/av_stream/ch0', '/live?channel=1&subtype=0', '/', '', '/flag?debug']) {
      expect(maskStreamPathSecrets(path)).toBe(path);
    }
  });

  it('Scenario: Given parameters that only look similar When masked Then they are not touched', () => {
    expect(maskStreamPathSecrets('/live?keyframe=1&username_hint=none')).toBe('/live?keyframe=1&username_hint=none');
  });

  it('Scenario: Given a masked path coming back When it is restored Then each placeholder takes the stored value', () => {
    const stored = '/stream0?username=admin&password=hunter2&channel=1';
    const incoming = maskStreamPathSecrets(stored);

    expect(restoreMaskedStreamPathSecrets(incoming, stored)).toBe(stored);
  });

  it('Scenario: Given the user retypes one secret When restored Then only the placeholder is replaced', () => {
    const stored = '/s?username=admin&password=old-secret';

    expect(restoreMaskedStreamPathSecrets(`/s?username=${MASKED_SECRET}&password=new-secret`, stored)).toBe('/s?username=admin&password=new-secret');
  });

  it('Scenario: Given a placeholder with no stored value When restored Then it is dropped instead of saving the mask', () => {
    expect(restoreMaskedStreamPathSecrets(`/s?token=${MASKED_SECRET}&channel=2`, '/s?channel=1')).toBe('/s?channel=2');
    expect(restoreMaskedStreamPathSecrets(`/s?token=${MASKED_SECRET}`, '/s')).toBe('/s');
  });

  it('Scenario: Given a path without placeholders When restored Then it is returned as typed', () => {
    expect(restoreMaskedStreamPathSecrets('/other?password=typed', '/s?password=old')).toBe('/other?password=typed');
  });

  it('Scenario: Given parameter names in a different case When restored Then they still match', () => {
    expect(restoreMaskedStreamPathSecrets(`/s?Password=${MASKED_SECRET}`, '/s?password=stored')).toBe('/s?Password=stored');
  });
});
