import type { NativeCameraDriver, NativeCameraEndpoint, NativeCameraNegotiation, NativeCameraStreamProfile, DiscoveredNativeCamera, PtzVector } from '../../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../../application/ports/NetworkProbePort';
import type { OnvifWsDiscoveryProbe } from '../onvif/OnvifWsDiscoveryProbe';
import { OnvifSoapClient, OnvifUnauthorizedError, orderProfilesByPreference } from '../onvif/OnvifSoapClient';
import type { OnvifCredentials } from '../onvif/OnvifSoapEnvelopes';

const RTSP_URL_PATTERN = /rtsp:\/\/[^/]+(?::(\d+))?(\/.*)/i;

/**
 * ONVIF PTZ camera driver. Negotiates the definitive stream endpoint via real
 * ONVIF SOAP calls (`GetCapabilities` → `GetProfiles` → `GetStreamUri`,
 * `OnvifSoapClient`) instead of the unmaintained `node-onvif` package, which
 * only exposed `init()`/`getUdpStreamUrl()` with no profile selection.
 * Falls back to a plain TCP reachability check when ONVIF negotiation fails
 * for any reason other than rejected credentials — same fallback contract as
 * before this replacement (see `specs/native-camera-onvif-profile-negotiation-v1.md`).
 *
 * PTZ (`specs/native-camera-ptz-control-v1.md`): once a profile is negotiated,
 * if it advertised a PTZ configuration, a best-effort `GetConfigurationOptions`
 * check confirms continuous-move support. This check never blocks negotiation
 * — any failure (unreachable PTZ service, malformed response) simply leaves
 * `ptzSupported: false`, since PTZ is a bonus capability on top of streaming,
 * not a requirement for it.
 */
export class OnvifPtzCameraDriver implements NativeCameraDriver {
  public readonly sourceType = 'onvif-ptz' as const;

  constructor(
    private readonly discoveryProbe: OnvifWsDiscoveryProbe,
    private readonly networkProbe: NetworkProbePort,
    private readonly soapClient: OnvifSoapClient = new OnvifSoapClient()
  ) {}

  public supportsDiscovery(): boolean {
    return true;
  }

  public async discover(): Promise<ReadonlyArray<DiscoveredNativeCamera>> {
    return this.discoveryProbe.probe();
  }

  public async negotiate(endpoint: NativeCameraEndpoint): Promise<NativeCameraNegotiation> {
    try {
      const negotiated = await this.negotiateViaOnvif(endpoint);
      if (negotiated) return negotiated;
    } catch (onvifErr: unknown) {
      if (onvifErr instanceof OnvifUnauthorizedError) {
        return { outcome: 'unauthorized' };
      }
      // Any other ONVIF failure (unreachable device_service, malformed response,
      // no usable profile) falls through to the TCP-only fallback below.
    }

    const reachable = await this.networkProbe.isReachable(endpoint.host, endpoint.rtspPort, 5000);
    if (!reachable) {
      return {
        outcome: 'unreachable',
        detail: `No se pudo alcanzar la cámara en ${endpoint.host}:${endpoint.rtspPort}. Verifique la IP, el puerto RTSP y que la cámara esté encendida.`
      };
    }
    return {
      outcome: 'reachable',
      profile: { rtspPort: endpoint.rtspPort, rtspPath: endpoint.rtspPath, profileToken: null, ptzConfigurationToken: null, ptzSupported: false }
    };
  }

  public supportsPtz(profile: NativeCameraStreamProfile): boolean {
    return profile.ptzSupported === true;
  }

  public async movePtz(endpoint: NativeCameraEndpoint, profile: NativeCameraStreamProfile, vector: PtzVector): Promise<void> {
    const { credentials, profileToken, ptzXAddr } = await this.resolvePtzTarget(endpoint, profile);
    await this.soapClient.continuousMove(ptzXAddr, credentials, profileToken, vector);
  }

  public async stopPtz(endpoint: NativeCameraEndpoint, profile: NativeCameraStreamProfile): Promise<void> {
    const { credentials, profileToken, ptzXAddr } = await this.resolvePtzTarget(endpoint, profile);
    await this.soapClient.stopPtz(ptzXAddr, credentials, profileToken);
  }

  private async resolvePtzTarget(endpoint: NativeCameraEndpoint, profile: NativeCameraStreamProfile): Promise<{ credentials: OnvifCredentials; profileToken: string; ptzXAddr: string }> {
    if (!profile.profileToken) {
      throw new Error('No hay un perfil ONVIF negociado para esta cámara');
    }
    const credentials = { username: endpoint.username, password: endpoint.password };
    const deviceServiceUrl = `http://${endpoint.host}:${endpoint.onvifPort}/onvif/device_service`;
    const { ptzXAddr } = await this.soapClient.getCapabilities(deviceServiceUrl, credentials);
    if (!ptzXAddr) {
      throw new Error('La cámara no reportó un servicio PTZ');
    }
    return { credentials, profileToken: profile.profileToken, ptzXAddr };
  }

  private async negotiateViaOnvif(endpoint: NativeCameraEndpoint): Promise<NativeCameraNegotiation | null> {
    const credentials = { username: endpoint.username, password: endpoint.password };
    const deviceServiceUrl = `http://${endpoint.host}:${endpoint.onvifPort}/onvif/device_service`;
    const mediaServiceUrl = await this.soapClient.getMediaServiceUrl(deviceServiceUrl, credentials);
    const profiles = await this.soapClient.getProfiles(mediaServiceUrl, credentials);
    const orderedProfiles = orderProfilesByPreference(profiles);

    for (const profile of orderedProfiles) {
      let streamUri: string;
      try {
        streamUri = await this.soapClient.getStreamUri(mediaServiceUrl, credentials, profile.token);
      } catch {
        continue; // try the next candidate profile
      }

      const match = streamUri.match(RTSP_URL_PATTERN);
      if (!match) continue;

      const ptzSupported = await this.detectPtzSupport(endpoint, profile.ptzConfigurationToken);

      return {
        outcome: 'negotiated',
        profile: {
          rtspPort: match[1] ? parseInt(match[1], 10) : 554,
          rtspPath: match[2],
          profileToken: profile.token,
          ptzConfigurationToken: profile.ptzConfigurationToken,
          ptzSupported,
        }
      };
    }

    return null;
  }

  private async detectPtzSupport(endpoint: NativeCameraEndpoint, ptzConfigurationToken: string | null): Promise<boolean> {
    if (!ptzConfigurationToken) return false;
    try {
      const credentials = { username: endpoint.username, password: endpoint.password };
      const deviceServiceUrl = `http://${endpoint.host}:${endpoint.onvifPort}/onvif/device_service`;
      const { ptzXAddr } = await this.soapClient.getCapabilities(deviceServiceUrl, credentials);
      if (!ptzXAddr) return false;
      const options = await this.soapClient.getPtzConfigurationOptions(ptzXAddr, credentials, ptzConfigurationToken);
      return options.supportsContinuousMove;
    } catch {
      return false;
    }
  }
}
