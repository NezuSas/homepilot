jest.mock('dgram', () => ({ createSocket: jest.fn() }));
jest.mock('os', () => ({ networkInterfaces: jest.fn() }));

import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import * as os from 'os';
import { OnvifWsDiscoveryProbe, parseProbeMatch } from '../infrastructure/onvif/OnvifWsDiscoveryProbe';

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
  it('probes every available IPv4 interface and deduplicates discovered cameras by urn', async () => {
    jest.useFakeTimers();
    const socket = new EventEmitter() as EventEmitter & {
      bind: jest.Mock;
      close: jest.Mock;
      send: jest.Mock;
      setBroadcast: jest.Mock;
      setMulticastTTL: jest.Mock;
    };
    socket.bind = jest.fn((_port: number, _address: string, callback: () => void) => callback());
    socket.close = jest.fn();
    socket.send = jest.fn();
    socket.setBroadcast = jest.fn();
    socket.setMulticastTTL = jest.fn();
    const createSocket = dgram.createSocket as jest.Mock;
    createSocket.mockReturnValue(socket as unknown as dgram.Socket);
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      ethernet: [{ address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.10/24' }],
    });

    try {
      const discovery = new OnvifWsDiscoveryProbe();
      const resultPromise = discovery.probe();
      socket.emit('message', Buffer.from(onvifProbeMatchXml()), { address: '192.168.1.50' });
      socket.emit('message', Buffer.from(onvifProbeMatchXml()), { address: '192.168.1.50' });
      await jest.advanceTimersByTimeAsync(4000);

      await expect(resultPromise).resolves.toEqual([expect.objectContaining({ urn: 'urn:uuid:1234-5678' })]);
      expect(createSocket).toHaveBeenCalledWith({ type: 'udp4', reuseAddr: true });
      expect(socket.setBroadcast).toHaveBeenCalledWith(true);
      expect(socket.setMulticastTTL).toHaveBeenCalledWith(128);
      expect(socket.send).toHaveBeenCalledTimes(2);
      expect(socket.close).toHaveBeenCalled();
    } finally {
      createSocket.mockReset();
      (os.networkInterfaces as jest.Mock).mockReset();
      jest.useRealTimers();
    }
  });

  it('returns an empty discovery result when a UDP socket fails before receiving a response', async () => {
    const socket = new EventEmitter() as EventEmitter & { bind: jest.Mock; close: jest.Mock };
    socket.bind = jest.fn();
    socket.close = jest.fn();
    const createSocket = dgram.createSocket as jest.Mock;
    createSocket.mockReturnValue(socket as unknown as dgram.Socket);
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      ethernet: [{ address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.10/24' }],
    });

    try {
      const resultPromise = new OnvifWsDiscoveryProbe().probe();
      socket.emit('error', new Error('network unavailable'));
      await expect(resultPromise).resolves.toEqual([]);
      expect(socket.close).toHaveBeenCalled();
    } finally {
      createSocket.mockReset();
      (os.networkInterfaces as jest.Mock).mockReset();
    }
  });
  it('uses HTTPS default port, skips invalid XAddrs, and generates an urn when the device omits one', () => {
    const httpsResult = parseProbeMatch(onvifProbeMatchXml({ xaddr: 'invalid-url https://camera.local/onvif/device_service' }), '192.168.1.77');
    expect(httpsResult).toEqual(expect.objectContaining({ host: 'camera.local', onvifPort: 443 }));

    const noAddressXml = onvifProbeMatchXml().replace('<a:EndpointReference><a:Address>urn:uuid:1234-5678</a:Address></a:EndpointReference>', '');
    const generated = parseProbeMatch(noAddressXml, '192.168.1.77');
    expect(generated?.urn).toMatch(/^urn:uuid:/);
  });
  it('falls back to the wildcard interface when no external IPv4 address is available', async () => {
    jest.useFakeTimers();
    const socket = new EventEmitter() as EventEmitter & { bind: jest.Mock; close: jest.Mock; send: jest.Mock; setBroadcast: jest.Mock; setMulticastTTL: jest.Mock };
    socket.bind = jest.fn((_port: number, _address: string, callback: () => void) => callback());
    socket.close = jest.fn();
    socket.send = jest.fn();
    socket.setBroadcast = jest.fn();
    socket.setMulticastTTL = jest.fn();
    const createSocket = dgram.createSocket as jest.Mock;
    createSocket.mockReturnValue(socket as unknown as dgram.Socket);
    (os.networkInterfaces as jest.Mock).mockReturnValue({ loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }] });

    try {
      const result = new OnvifWsDiscoveryProbe().probe();
      await jest.advanceTimersByTimeAsync(4_000);
      await expect(result).resolves.toEqual([]);
      expect(socket.bind).toHaveBeenCalledWith(0, '0.0.0.0', expect.any(Function));
    } finally {
      createSocket.mockReset();
      (os.networkInterfaces as jest.Mock).mockReset();
      jest.useRealTimers();
    }
  });

  it('closes and resolves when socket setup fails synchronously', async () => {
    const socket = new EventEmitter() as EventEmitter & { bind: jest.Mock; close: jest.Mock; send: jest.Mock; setBroadcast: jest.Mock; setMulticastTTL: jest.Mock };
    socket.bind = jest.fn((_port: number, _address: string, callback: () => void) => callback());
    socket.close = jest.fn();
    socket.send = jest.fn();
    socket.setBroadcast = jest.fn(() => { throw new Error('broadcast unavailable'); });
    socket.setMulticastTTL = jest.fn();
    const createSocket = dgram.createSocket as jest.Mock;
    createSocket.mockReturnValue(socket as unknown as dgram.Socket);
    (os.networkInterfaces as jest.Mock).mockReturnValue({ ethernet: [{ address: '192.168.1.10', family: 'IPv4', internal: false }] });

    try {
      await expect(new OnvifWsDiscoveryProbe().probe()).resolves.toEqual([]);
      expect(socket.close).toHaveBeenCalled();
    } finally {
      createSocket.mockReset();
      (os.networkInterfaces as jest.Mock).mockReset();
    }
  });

  it('ignores malformed message payloads and still resolves the probe', async () => {
    jest.useFakeTimers();
    const socket = new EventEmitter() as EventEmitter & { bind: jest.Mock; close: jest.Mock; send: jest.Mock; setBroadcast: jest.Mock; setMulticastTTL: jest.Mock };
    socket.bind = jest.fn((_port: number, _address: string, callback: () => void) => callback());
    socket.close = jest.fn();
    socket.send = jest.fn();
    socket.setBroadcast = jest.fn();
    socket.setMulticastTTL = jest.fn();
    const createSocket = dgram.createSocket as jest.Mock;
    createSocket.mockReturnValue(socket as unknown as dgram.Socket);
    (os.networkInterfaces as jest.Mock).mockReturnValue({ ethernet: [{ address: '192.168.1.10', family: 'IPv4', internal: false }] });

    try {
      const result = new OnvifWsDiscoveryProbe().probe();
      socket.emit('message', { toString: () => { throw new Error('bad datagram'); } }, { address: '192.168.1.50' });
      await jest.advanceTimersByTimeAsync(4_000);
      await expect(result).resolves.toEqual([]);
    } finally {
      createSocket.mockReset();
      (os.networkInterfaces as jest.Mock).mockReset();
      jest.useRealTimers();
    }
  });
});
