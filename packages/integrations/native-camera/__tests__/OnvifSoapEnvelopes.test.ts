import * as crypto from 'crypto';
import { buildPasswordDigest, buildGetCapabilitiesEnvelope, buildGetProfilesEnvelope, buildGetStreamUriEnvelope, buildGetPtzConfigurationOptionsEnvelope, buildContinuousMoveEnvelope, buildPtzStopEnvelope } from '../infrastructure/onvif/OnvifSoapEnvelopes';

describe('OnvifSoapEnvelopes', () => {
  it('buildPasswordDigest is deterministic against a fixed nonce/timestamp/password (WS-Security PasswordDigest)', () => {
    const nonce = Buffer.from('0123456789abcdef', 'utf8');
    const created = '2026-01-01T00:00:00.000Z';

    const digest = buildPasswordDigest(nonce, created, 'secret');

    // sha1(nonce || created || password), base64-encoded — recomputed independently to
    // guard against silently changing the WS-Security digest algorithm.
    const expected = crypto.createHash('sha1')
      .update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from('secret', 'utf8')]))
      .digest('base64');
    expect(digest).toBe(expected);
  });

  it('buildPasswordDigest changes when any of nonce/created/password changes', () => {
    const nonce = Buffer.from('0123456789abcdef', 'utf8');
    const created = '2026-01-01T00:00:00.000Z';
    const base = buildPasswordDigest(nonce, created, 'secret');

    expect(buildPasswordDigest(Buffer.from('fedcba9876543210', 'utf8'), created, 'secret')).not.toBe(base);
    expect(buildPasswordDigest(nonce, '2026-01-02T00:00:00.000Z', 'secret')).not.toBe(base);
    expect(buildPasswordDigest(nonce, created, 'different')).not.toBe(base);
  });

  it('builds a GetCapabilities envelope containing a WS-Security UsernameToken', () => {
    const envelope = buildGetCapabilitiesEnvelope({ username: 'admin', password: 'secret' });

    expect(envelope).toContain('<GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl">');
    expect(envelope).toContain('<UsernameToken>');
    expect(envelope).toContain('<Username>admin</Username>');
    expect(envelope).toContain('PasswordDigest');
    expect(envelope).not.toContain('secret');
  });

  it('escapes XML-sensitive characters in the username', () => {
    const envelope = buildGetCapabilitiesEnvelope({ username: '<admin>&"quoted"', password: 'secret' });

    expect(envelope).toContain('&lt;admin&gt;&amp;&quot;quoted&quot;');
    expect(envelope).not.toContain('<admin>&"quoted"');
  });

  it('builds a GetProfiles envelope', () => {
    const envelope = buildGetProfilesEnvelope({ username: 'admin', password: 'secret' });
    expect(envelope).toContain('<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>');
  });

  it('builds a GetStreamUri envelope requesting RTP-Unicast/RTSP for the given profile token', () => {
    const envelope = buildGetStreamUriEnvelope({ username: 'admin', password: 'secret' }, 'Profile_1');

    expect(envelope).toContain('<ProfileToken>Profile_1</ProfileToken>');
    expect(envelope).toContain('<Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>');
    expect(envelope).toContain('<Protocol>RTSP</Protocol>');
  });

  it('escapes the profile token in GetStreamUri', () => {
    const envelope = buildGetStreamUriEnvelope({ username: 'admin', password: 'secret' }, '<token>');
    expect(envelope).toContain('<ProfileToken>&lt;token&gt;</ProfileToken>');
  });
  it('builds PTZ configuration, movement, and stop envelopes with escaped tokens', () => {
    const credentials = { username: 'admin', password: 'secret' };
    const options = buildGetPtzConfigurationOptionsEnvelope(credentials, '<configuration>');
    const movement = buildContinuousMoveEnvelope(credentials, '<profile>', { pan: 0.5, tilt: -0.25, zoom: 1 });
    const defaultMovement = buildContinuousMoveEnvelope(credentials, 'profile', {});
    const stop = buildPtzStopEnvelope(credentials, '<profile>');

    expect(options).toContain('<ConfigurationToken>&lt;configuration&gt;</ConfigurationToken>');
    expect(movement).toContain('<ProfileToken>&lt;profile&gt;</ProfileToken>');
    expect(movement).toContain('x="0.5" y="-0.25"');
    expect(movement).toContain('<Zoom xmlns="http://www.onvif.org/ver10/schema" x="1"/>');
    expect(defaultMovement).toContain('x="0" y="0"');
    expect(defaultMovement).toContain('x="0"/>');
    expect(stop).toContain('<ProfileToken>&lt;profile&gt;</ProfileToken>');
    expect(stop).toContain('<PanTilt>true</PanTilt>');
    expect(stop).toContain('<Zoom>true</Zoom>');
  });
});
