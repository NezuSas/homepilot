import type { NativeCameraEndpoint, NativeCameraNegotiation } from '../../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../../application/ports/NetworkProbePort';

/**
 * Shared negotiation body for protocols with no negotiation mechanism of their
 * own (RTSP/DVR, Sonoff-RTSP): the operator-supplied `rtspPath` is used
 * verbatim, only TCP reachability on `rtspPort` is confirmed. A tiny function,
 * not a base class, since each driver's body is otherwise a one-liner.
 */
export async function negotiateTcpOnly(
  endpoint: NativeCameraEndpoint,
  networkProbe: NetworkProbePort
): Promise<NativeCameraNegotiation> {
  const reachable = await networkProbe.isReachable(endpoint.host, endpoint.rtspPort, 5000);
  if (!reachable) {
    return {
      outcome: 'unreachable',
      detail: `No se pudo alcanzar la cámara en ${endpoint.host}:${endpoint.rtspPort}. Verifique la IP, el puerto RTSP y que la cámara esté encendida.`
    };
  }
  return { outcome: 'reachable', profile: { rtspPort: endpoint.rtspPort, rtspPath: endpoint.rtspPath, profileToken: null, ptzConfigurationToken: null, ptzSupported: false } };
}
