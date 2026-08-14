import { parseProbeMatch } from '../infrastructure/onvif/OnvifWsDiscoveryProbe';

/**
 * Unit coverage for the WS-Discovery response parser (moved verbatim from the
 * former `apps/api/OnvifDiscovery.ts`). Phase 2 replaces this regex-based
 * parsing with `fast-xml-parser` and a stricter ONVIF-scope check — this
 * suite documents today's exact behaviour, including its known weak spot
 * (the plain substring `"onvif"` filter), so a Phase 2 regression is visible.
 */
describe('OnvifWsDiscoveryProbe - parseProbeMatch', () => {
  const onvifProbeMatchXml = (opts?: { xaddr?: string; scopes?: string }) => `
    <e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
      <e:Body>
        <d:ProbeMatches>
          <d:ProbeMatch>
            <a:EndpointReference><a:Address>urn:uuid:1234-5678</a:Address></a:EndpointReference>
            <d:Types>dn:NetworkVideoTransmitter</d:Types>
            <d:Scopes>${opts?.scopes ?? 'onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/name/Camara%20Patio'}</d:Scopes>
            <d:XAddrs>${opts?.xaddr ?? 'http://192.168.1.50:8000/onvif/device_service'}</d:XAddrs>
          </d:ProbeMatch>
        </d:ProbeMatches>
      </e:Body>
    </e:Envelope>`;

  it('parses a well-formed ONVIF ProbeMatch into a DiscoveredNativeCamera', () => {
    const result = parseProbeMatch(onvifProbeMatchXml(), '192.168.1.50');

    expect(result).toEqual({
      urn: 'urn:uuid:1234-5678',
      name: 'Camara Patio',
      host: '192.168.1.50',
      onvifPort: 8000,
    });
  });

  it('falls back to a generated name when Scopes has no onvif name segment', () => {
    const result = parseProbeMatch(onvifProbeMatchXml({ scopes: 'onvif://www.onvif.org/type/video_encoder' }), '192.168.1.50');

    expect(result?.name).toBe('ONVIF Camera (192.168.1.50)');
  });

  it('falls back to the remote address and port 80 when XAddrs is unparsable', () => {
    const result = parseProbeMatch(onvifProbeMatchXml({ xaddr: 'not-a-url' }), '192.168.1.77');

    expect(result?.host).toBe('192.168.1.77');
    expect(result?.onvifPort).toBe(80);
  });

  it('ignores a non-ONVIF response (e.g. a smart TV replying to the generic probe) when it lacks the "onvif" substring', () => {
    const smartTvXml = `
      <e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">
        <e:Body>
          <d:ProbeMatches>
            <d:ProbeMatch>
              <d:XAddrs>http://192.168.1.99:80/description.xml</d:XAddrs>
            </d:ProbeMatch>
          </d:ProbeMatches>
        </e:Body>
      </e:Envelope>`;

    expect(parseProbeMatch(smartTvXml, '192.168.1.99')).toBeNull();
  });

  it('ignores a payload that is neither a ProbeMatch nor a Hello message', () => {
    expect(parseProbeMatch('<e:Envelope><e:Body>onvif but unrelated</e:Body></e:Envelope>', '192.168.1.1')).toBeNull();
  });

  it('accepts a Hello message the same way as a ProbeMatch', () => {
    const helloXml = `
      <e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
        <e:Body>
          <d:Hello>
            <a:EndpointReference><a:Address>urn:uuid:hello-1</a:Address></a:EndpointReference>
            <d:Scopes>onvif://www.onvif.org/name/Camara%20Sala</d:Scopes>
            <d:XAddrs>http://192.168.1.60:80/onvif/device_service</d:XAddrs>
          </d:Hello>
        </e:Body>
      </e:Envelope>`;

    const result = parseProbeMatch(helloXml, '192.168.1.60');
    expect(result?.name).toBe('Camara Sala');
  });
});
