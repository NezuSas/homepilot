import type { FrameCaptureFailure, MediaTranscoderPort, NativeCameraRtspEndpoint } from './ports/MediaTranscoderPort';
import type { NativeCameraDriverRegistry } from './ports/NativeCameraDriverRegistry';
import { isNativeCameraSourceType, isValidPort } from './NativeCameraService';

export type CameraTestFailureCode =
  | 'CREDENTIALS_REJECTED'
  | 'PATH_NOT_FOUND'
  | 'PORT_CLOSED'
  | 'UNREACHABLE'
  | 'TIMEOUT'
  | 'NO_VIDEO'
  | 'INVALID_INPUT';

export interface CameraTestSuccess {
  /** `data:image/jpeg;base64,…` of one frame, so the person can see the camera before saving it. */
  readonly snapshot: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly codec: string | null;
  readonly ptzSupported: boolean;
}

export interface CameraTestFailure {
  readonly code: CameraTestFailureCode;
  readonly message: string;
  readonly hint: string;
}

export type CameraTestResult =
  | { readonly ok: true; readonly value: CameraTestSuccess }
  | { readonly ok: false; readonly error: CameraTestFailure };

const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

/** Destinations a camera is never reachable at; refusing them keeps the test from probing the host itself or cloud metadata. */
function isForbiddenHost(host: string): boolean {
  return host === '0.0.0.0' || /^169\.254\./.test(host) || /^0+\./.test(host);
}

const failure = (code: CameraTestFailureCode, message: string, hint: string): CameraTestResult => ({ ok: false, error: { code, message, hint } });
const invalid = (message: string): CameraTestResult => failure('INVALID_INPUT', message, 'Revisa los datos y vuelve a intentarlo.');

function explain(reason: FrameCaptureFailure, host: string, port: number): CameraTestResult {
  switch (reason) {
    case 'UNAUTHORIZED':
      return failure('CREDENTIALS_REJECTED', 'La cámara rechazó el usuario o la contraseña.',
        'Usa los datos de la propia cámara, no los de tu cuenta del fabricante, y confirma que ese usuario puede ver el video. Algunas cámaras piden crear antes un usuario para RTSP u ONVIF en su aplicación.');
    case 'NOT_FOUND':
      return failure('PATH_NOT_FOUND', 'La cámara respondió, pero no reconoce esa ruta de video.',
        'Revisa la ruta que corresponde a tu marca y modelo (por ejemplo /Streaming/Channels/101 en Hikvision) y el número de canal.');
    case 'CONNECTION_REFUSED':
      return failure('PORT_CLOSED', `La cámara rechazó la conexión en el puerto ${port}.`,
        'Activa RTSP en la configuración de la cámara o revisa el puerto; el habitual es el 554.');
    case 'UNREACHABLE':
      return failure('UNREACHABLE', `No se pudo llegar a ${host}.`,
        'Comprueba que la cámara esté encendida, conectada a la misma red que este equipo y que la dirección IP sea la correcta.');
    case 'TIMEOUT':
      return failure('TIMEOUT', 'La cámara tardó demasiado en responder.',
        'Puede estar ocupada o con mala señal Wi-Fi. Inténtalo de nuevo o prueba con el flujo secundario de la cámara.');
    case 'NO_VIDEO':
      return failure('NO_VIDEO', 'La cámara respondió, pero no entregó un video que se pueda mostrar.',
        'Si el flujo usa H.265, cámbialo a H.264 en la configuración de la cámara y vuelve a probar.');
    default:
      return failure('NO_VIDEO', 'No se pudo abrir el video de la cámara.',
        'Revisa la dirección, el puerto, la ruta y las credenciales, y vuelve a probar.');
  }
}

/**
 * Tries a camera before it is saved: opens its video, grabs one frame and says why when it cannot.
 * Nothing is persisted, and neither the answer nor the messages carry credentials.
 */
export class NativeCameraConnectionTester {
  constructor(
    private readonly driverRegistry: NativeCameraDriverRegistry,
    private readonly transcoder: MediaTranscoderPort,
  ) {}

  public async test(input: Record<string, unknown>): Promise<CameraTestResult> {
    const host = typeof input.host === 'string' ? input.host.trim() : '';
    if (!host) return invalid('Falta la dirección de la cámara.');
    if (!HOSTNAME.test(host) || isForbiddenHost(host)) return invalid('La dirección de la cámara no es válida.');
    if (typeof input.username !== 'string' || !input.username) return invalid('Falta el usuario de la cámara.');
    if (typeof input.password !== 'string' || !input.password) return invalid('Falta la contraseña de la cámara.');

    const sourceType = isNativeCameraSourceType(input.sourceType) ? input.sourceType : 'onvif-ptz';
    const rtspPort = input.rtspPort ?? 554;
    const onvifPort = input.onvifPort ?? (sourceType === 'onvif-ptz' ? 8000 : 80);
    if (!isValidPort(rtspPort) || !isValidPort(onvifPort)) return invalid('Los puertos deben estar entre 1 y 65535.');

    let endpoint: NativeCameraRtspEndpoint = {
      host, rtspPort, username: input.username, password: input.password,
      rtspPath: typeof input.rtspPath === 'string' ? input.rtspPath.trim() : '',
    };
    let ptzSupported = false;

    if (sourceType === 'onvif-ptz') {
      const negotiation = await this.driverRegistry.resolve(sourceType).negotiate({ ...endpoint, onvifPort });
      if (negotiation.outcome === 'unauthorized') return explain('UNAUTHORIZED', host, rtspPort);
      if (negotiation.outcome === 'unreachable') return explain('UNREACHABLE', host, rtspPort);
      endpoint = { ...endpoint, rtspPort: negotiation.profile.rtspPort, rtspPath: negotiation.profile.rtspPath };
      ptzSupported = negotiation.profile.ptzSupported;
    } else if (!endpoint.rtspPath) {
      return invalid('Falta la ruta de video de la cámara.');
    }

    const frame = await this.transcoder.captureFrame(endpoint);
    if (!frame.ok) return explain(frame.reason, host, endpoint.rtspPort);
    return {
      ok: true,
      value: {
        snapshot: `data:image/jpeg;base64,${frame.jpeg.toString('base64')}`,
        width: frame.width,
        height: frame.height,
        codec: frame.codec,
        ptzSupported,
      },
    };
  }
}
