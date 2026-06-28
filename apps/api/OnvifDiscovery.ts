import * as dgram from 'dgram';
import * as crypto from 'crypto';

export interface DiscoveredDevice {
  urn: string;
  name: string;
  host: string;
  onvifPort: number;
}

export class OnvifDiscovery {
  public static async discover(timeoutMs: number = 3000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const devices = new Map<string, DiscoveredDevice>();
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      const uuid = crypto.randomUUID();
      const probeXml = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
  xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:${uuid}</w:MessageID>
    <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;

      const message = Buffer.from(probeXml);

      socket.on('message', (msg, rinfo) => {
        const responseStr = msg.toString();
        // Check if it's a ProbeMatch
        if (!responseStr.includes('ProbeMatch')) return;

        // Extract EndpointReference Address (URN)
        const urnMatch = responseStr.match(/<w:Address>([^<]+)<\/w:Address>/) 
                         || responseStr.match(/<Address.*?>([^<]+)<\/Address>/);
        const urn = urnMatch ? urnMatch[1] : `urn:uuid:${crypto.randomUUID()}`;

        // Extract XAddrs (URLs like http://192.168.1.100:8000/onvif/device_service)
        const xaddrMatch = responseStr.match(/<d:XAddrs>([^<]+)<\/d:XAddrs>/) 
                           || responseStr.match(/<XAddrs.*?>([^<]+)<\/XAddrs>/);
        
        let host = rinfo.address;
        let onvifPort = 80;

        if (xaddrMatch && xaddrMatch[1]) {
          const urls = xaddrMatch[1].trim().split(/\s+/);
          if (urls.length > 0) {
            try {
              const url = new URL(urls[0]);
              host = url.hostname;
              onvifPort = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
            } catch {
              // Ignore invalid URL
            }
          }
        }

        if (!devices.has(urn)) {
          devices.set(urn, {
            urn,
            name: `ONVIF Camera (${host})`,
            host,
            onvifPort
          });
        }
      });

      socket.on('error', (err) => {
        console.error('[ONVIF Discovery] Socket error:', err);
        socket.close();
        resolve(Array.from(devices.values()));
      });

      // Bind and send
      socket.bind(() => {
        socket.setBroadcast(true);
        // Send to standard WS-Discovery multicast address
        socket.send(message, 0, message.length, 3702, '239.255.255.250', (err) => {
          if (err) {
            console.error('[ONVIF Discovery] Send error:', err);
          }
        });
      });

      // Close after timeout and resolve with what we found
      setTimeout(() => {
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(Array.from(devices.values()));
      }, timeoutMs);
    });
  }
}
