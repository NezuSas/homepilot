export const INSTALLATION_ATTESTATION_EXPIRES_IN = 90;
export const INSTALLATION_ATTESTATION_TIMEOUT_MS = 10_000;

export type InstallationVerificationErrorCode =
  | 'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED'
  | 'INSTALLATION_VERIFICATION_INPUT_INVALID'
  | 'INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE'
  | 'INSTALLATION_VERIFICATION_DIRECTORY_REJECTED'
  | 'INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID'
  | 'INSTALLATION_VERIFICATION_TIMEOUT';

export class InstallationVerificationError extends Error {
  constructor(readonly code: InstallationVerificationErrorCode) {
    super(code);
    this.name = 'InstallationVerificationError';
  }
}

export interface InstallationChallenge {
  installationId: string;
  challengeId: string;
  nonce: string;
}

export interface InstallationAttestation {
  attestation: string;
  expiresIn: typeof INSTALLATION_ATTESTATION_EXPIRES_IN;
}

type DirectoryFetch = (url: string, init: RequestInit) => Promise<Response>;
type EdgeConfigProvider = () => { url: string; token: string; homeId: string; edgeId: string } | null;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base64urlPattern = /^[A-Za-z0-9_-]+$/;

/** Only the existing, provisioned WSS gateway may determine the Directory host. */
export function directoryAttestationUrl(gatewayUrl: string): string {
  try {
    const url = new URL(gatewayUrl);
    if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw new Error('INVALID_GATEWAY_URL');
    }
    url.protocol = 'https:';
    url.pathname = '/directory/edge-attestation';
    return url.toString();
  } catch {
    throw new InstallationVerificationError('INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
  }
}

export function parseInstallationChallenge(value: unknown): InstallationChallenge {
  if (!isExactObject(value, ['installationId', 'challengeId', 'nonce'])) {
    throw new InstallationVerificationError('INSTALLATION_VERIFICATION_INPUT_INVALID');
  }
  const { installationId, challengeId, nonce } = value;
  if (typeof installationId !== 'string' || !uuidPattern.test(installationId)
    || typeof challengeId !== 'string' || !uuidPattern.test(challengeId)
    || typeof nonce !== 'string' || nonce.length !== 43 || !base64urlPattern.test(nonce)
    || Buffer.from(nonce, 'base64url').length !== 32
    || Buffer.from(nonce, 'base64url').toString('base64url') !== nonce) {
    throw new InstallationVerificationError('INSTALLATION_VERIFICATION_INPUT_INVALID');
  }
  return { installationId, challengeId, nonce };
}

function isExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function parseDirectoryResponse(value: unknown): InstallationAttestation {
  if (!isExactObject(value, ['attestation', 'expiresIn'])
    || typeof value.attestation !== 'string'
    || value.attestation.length > 8192
    || value.expiresIn !== INSTALLATION_ATTESTATION_EXPIRES_IN) {
    throw new InstallationVerificationError('INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID');
  }
  const parts = value.attestation.split('.');
  if (parts.length !== 2 || parts.some((part) => !part || !base64urlPattern.test(part))) {
    throw new InstallationVerificationError('INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID');
  }
  return { attestation: value.attestation, expiresIn: INSTALLATION_ATTESTATION_EXPIRES_IN };
}

/** Ephemeral broker: it neither verifies signatures nor persists challenges or proofs. */
export class InstallationVerificationBroker {
  constructor(
    private readonly configProvider: EdgeConfigProvider,
    private readonly directoryFetch: DirectoryFetch = fetch,
  ) {}

  async attest(input: unknown): Promise<InstallationAttestation> {
    const challenge = parseInstallationChallenge(input);
    const config = this.configProvider();
    if (!config || !config.token?.trim() || !config.homeId?.trim() || !config.edgeId?.trim()) {
      throw new InstallationVerificationError('INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
    }
    const url = directoryAttestationUrl(config.url);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, INSTALLATION_ATTESTATION_TIMEOUT_MS);
    try {
      const response = await this.directoryFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(challenge),
        signal: controller.signal,
      });
      if (controller.signal.aborted) throw new InstallationVerificationError('INSTALLATION_VERIFICATION_TIMEOUT');
      if (!response.ok) {
        throw new InstallationVerificationError(
          response.status >= 500
            ? 'INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE'
            : 'INSTALLATION_VERIFICATION_DIRECTORY_REJECTED',
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (controller.signal.aborted) throw new InstallationVerificationError('INSTALLATION_VERIFICATION_TIMEOUT');
        throw new InstallationVerificationError('INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID');
      }
      if (controller.signal.aborted) throw new InstallationVerificationError('INSTALLATION_VERIFICATION_TIMEOUT');
      return parseDirectoryResponse(payload);
    } catch (error) {
      if (error instanceof InstallationVerificationError) throw error;
      if (timedOut || controller.signal.aborted) {
        throw new InstallationVerificationError('INSTALLATION_VERIFICATION_TIMEOUT');
      }
      throw new InstallationVerificationError('INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
}
