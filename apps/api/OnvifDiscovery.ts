export interface DiscoveredDevice {
  urn: string;
  name: string;
  host: string;
  onvifPort: number;
}

export class OnvifDiscovery {
  public static async discover(): Promise<DiscoveredDevice[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const onvif = require('node-onvif');
      const devices = await onvif.startProbe();
      const results: DiscoveredDevice[] = [];

      for (const d of devices) {
        if (!d.xaddrs || d.xaddrs.length === 0) continue;
        
        let host = '';
        let onvifPort = 80;
        
        try {
          const url = new URL(d.xaddrs[0]);
          host = url.hostname;
          onvifPort = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
        } catch {
          continue;
        }

        results.push({
          urn: d.urn || `urn:uuid:${Math.random()}`,
          name: d.name || `ONVIF Camera (${host})`,
          host,
          onvifPort
        });
      }
      return results;
    } catch (err) {
      console.error('[ONVIF Discovery] Error:', err);
      return [];
    }
  }
}
