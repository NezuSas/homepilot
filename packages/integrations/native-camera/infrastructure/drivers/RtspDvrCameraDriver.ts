import type { NativeCameraDriver, NativeCameraEndpoint, NativeCameraNegotiation, DiscoveredNativeCamera } from '../../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../../application/ports/NetworkProbePort';
import { negotiateTcpOnly } from './TcpOnlyNegotiation';

export class RtspDvrCameraDriver implements NativeCameraDriver {
  public readonly sourceType = 'rtsp-dvr' as const;

  constructor(private readonly networkProbe: NetworkProbePort) {}

  public supportsDiscovery(): boolean {
    return false;
  }

  public async discover(): Promise<ReadonlyArray<DiscoveredNativeCamera>> {
    return [];
  }

  public negotiate(endpoint: NativeCameraEndpoint): Promise<NativeCameraNegotiation> {
    return negotiateTcpOnly(endpoint, this.networkProbe);
  }

  public supportsPtz(): boolean {
    return false;
  }
}
