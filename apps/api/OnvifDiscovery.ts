import * as dgram from 'dgram';
import * as crypto from 'crypto';

export interface DiscoveredDevice {
  urn: string;
  name: string;
  host: string;
  onvifPort: number;
}

const WS_DISCOVERY_MULTICAST = '239.255.255.250';
const WS_DISCOVERY_PORT = 3702;
const DISCOVERY_TIMEOUT_MS = 4000;

function buildProbeMessage(): Buffer {
  const uuid = crypto.randomUUID();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<e:Envelope',
    '  xmlns:e="http://www.w3.org/2003/05/soap-envelope"',
    '  xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"',
    '  xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"',
    '  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">',
    '  <e:Header>',
    `    <w:MessageID>uuid:${uuid}</w:MessageID>`,
    '    <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>',
    '    <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>',
    '  </e:Header>',
    '  <e:Body>',
    '    <d:Probe>',
    '      <d:Types>dn:NetworkVideoTransmitter</d:Types>',
    '    </d:Probe>',
    '  </e:Body>',
    '</e:Envelope>',
  ].join('\n');
  return Buffer.from(xml, 'utf8');
}

function extractText(xml: string, tag: string): string | null {
  // Try namespace-qualified and unqualified
  const patterns = [
    new RegExp(`<[^>]*:${tag}[^>]*>([\\s\\S]*?)<\/[^>]*:${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function parseProbeMatch(xml: string, remoteAddress: string): DiscoveredDevice | null {
  if (!xml.includes('ProbeMatch') && !xml.includes('Hello')) return null;

  const urn = extractText(xml, 'Address') ?? `urn:uuid:${crypto.randomUUID()}`;
  const xaddrs = extractText(xml, 'XAddrs') ?? '';
  const scope = extractText(xml, 'Scopes') ?? '';

  // Try to get friendly name from scopes
  let name = '';
  const nameMatch = scope.match(/onvif:\/\/www\.onvif\.org\/name\/([^\s]+)/i);
  if (nameMatch) name = decodeURIComponent(nameMatch[1]);

  let host = remoteAddress;
  let onvifPort = 80;

  const urls = xaddrs.trim().split(/\s+/).filter(Boolean);
  for (const urlStr of urls) {
    try {
      const u = new URL(urlStr);
      host = u.hostname;
      onvifPort = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
      break;
    } catch {
      // ignore, try next
    }
  }

  if (!name) name = `ONVIF Camera (${host})`;

  return { urn, name, host, onvifPort };
}

function getLocalInterfaces(): string[] {
  const os = require('os');
  const nets: Record<string, any[]> = os.networkInterfaces();
  const addresses: string[] = [];
  for (const list of Object.values(nets)) {
    for (const iface of (list ?? [])) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address as string);
      }
    }
  }
  // Always include 0.0.0.0 as fallback
  if (addresses.length === 0) addresses.push('0.0.0.0');
  return addresses;
}

export class OnvifDiscovery {
  public static async discover(): Promise<DiscoveredDevice[]> {
    const deviceMap = new Map<string, DiscoveredDevice>();
    const message = buildProbeMessage();
    const localAddresses = getLocalInterfaces();

    const probeOnInterface = (bindAddress: string): Promise<void> => {
      return new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.on('error', () => {
          try { socket.close(); } catch { /* ignore */ }
          resolve();
        });

        socket.on('message', (msg, rinfo) => {
          try {
            const xml = msg.toString('utf8');
            const device = parseProbeMatch(xml, rinfo.address);
            if (device && !deviceMap.has(device.urn)) {
              deviceMap.set(device.urn, device);
            }
          } catch {
            // ignore malformed responses
          }
        });

        socket.bind(0, bindAddress, () => {
          try {
            socket.setBroadcast(true);
            socket.setMulticastTTL(128);
            // Send probe twice for reliability
            socket.send(message, 0, message.length, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST);
            setTimeout(() => {
              try {
                socket.send(message, 0, message.length, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST);
              } catch { /* ignore */ }
            }, 500);
          } catch {
            try { socket.close(); } catch { /* ignore */ }
            resolve();
            return;
          }

          setTimeout(() => {
            try { socket.close(); } catch { /* ignore */ }
            resolve();
          }, DISCOVERY_TIMEOUT_MS);
        });
      });
    };

    await Promise.all(localAddresses.map(probeOnInterface));
    return Array.from(deviceMap.values());
  }
}
