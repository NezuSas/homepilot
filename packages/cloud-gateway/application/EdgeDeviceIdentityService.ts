import { createPublicKey } from 'node:crypto';
import { DeviceIdentityError, type DeviceIdentityProvider } from './DeviceIdentityProvider';
import { directoryEdgeDeviceUrl, type BoundDeviceIdentity, type CloudGatewayConnectorConfig } from './EdgeDeviceContract';

type EdgeConfigProvider = () => CloudGatewayConnectorConfig | null;
type BindingStore = { get(): BoundDeviceIdentity | null; bind(identity: BoundDeviceIdentity): void };
type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;

export type DeviceReadiness = { status: 'READY' } | { status: 'NOT_READY'; code: 'DEVICE_IDENTITY_INVALID' };

export class EdgeDeviceIdentityService {
  private readiness: DeviceReadiness = { status: 'READY' };

  constructor(
    private readonly bindingStore: BindingStore,
    readonly provider: DeviceIdentityProvider,
    private readonly configProvider: EdgeConfigProvider,
    private readonly httpFetch: HttpFetch = fetch,
  ) {}

  getBinding(): BoundDeviceIdentity | null { return this.bindingStore.get(); }
  getReadiness(): DeviceReadiness { return this.readiness; }
  assertReady(): void { if (this.readiness.status !== 'READY') throw new DeviceIdentityError(); }

  /** Entirely local; Directory availability never influences startup readiness. */
  async verifyAtStartup(): Promise<DeviceReadiness> {
    const binding = this.bindingStore.get();
    if (!binding) return this.readiness = { status: 'READY' };
    try {
      const config = this.configProvider();
      const valid = config?.homeId === binding.homeId && config.edgeId === binding.edgeId
        && binding.algorithm === this.provider.getAlgorithm()
        && (process.env.NODE_ENV !== 'production' || this.provider.cloneResistant)
        && await this.provider.getKeyId() === binding.keyId
        && await this.provider.verifyLocalIdentity(binding.publicKey);
      return this.readiness = valid ? { status: 'READY' } : { status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID' };
    } catch { return this.readiness = { status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID' }; }
  }

  /** Provisioning-only operation. Never invoked from startup. */
  async enroll(): Promise<BoundDeviceIdentity> {
    if (this.bindingStore.get()) throw new Error('DEVICE_ALREADY_BOUND');
    if (process.env.NODE_ENV === 'production' && !this.provider.cloneResistant) throw new DeviceIdentityError();
    const config = this.configProvider();
    if (!config?.token?.trim() || !config.homeId?.trim() || !config.edgeId?.trim()) throw new Error('EDGE_NOT_PAIRED');
    await this.provider.ensureIdentity();
    const publicKey = await this.provider.getPublicKey();
    const parsedKey = createPublicKey(publicKey);
    if (parsedKey.asymmetricKeyType !== 'ec' || parsedKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new DeviceIdentityError();
    if (!await this.provider.verifyLocalIdentity(publicKey)) throw new DeviceIdentityError();
    const keyId = await this.provider.getKeyId();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(keyId) || this.provider.getAlgorithm() !== 'ES256') throw new DeviceIdentityError();
    let response: Response;
    try {
      response = await this.httpFetch(directoryEdgeDeviceUrl(config.url, 'enroll'), {
        method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, algorithm: 'ES256', publicKey }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new Error('DEVICE_ENROLLMENT_UNAVAILABLE'); }
    if (response.status === 409) throw new Error('DEVICE_ALREADY_BOUND');
    if (response.status !== 201) throw new Error('DEVICE_ENROLLMENT_REJECTED');
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new Error('DEVICE_ENROLLMENT_RESPONSE_INVALID'); }
    if (!isEnrollmentResponse(payload) || payload.edgeId !== config.edgeId || payload.keyId !== keyId) {
      throw new Error('DEVICE_ENROLLMENT_RESPONSE_INVALID');
    }
    const binding: BoundDeviceIdentity = { bindingState: 'bound', homeId: config.homeId, edgeId: config.edgeId,
      keyId, publicKey, algorithm: 'ES256', boundAt: payload.boundAt };
    this.bindingStore.bind(binding);
    const readiness = await this.verifyAtStartup();
    if (readiness.status !== 'READY') throw new DeviceIdentityError();
    return binding;
  }
}

function isEnrollmentResponse(value: unknown): value is { edgeId: string; keyId: string; algorithm: 'ES256'; boundAt: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 4 && typeof row.edgeId === 'string' && typeof row.keyId === 'string'
    && row.algorithm === 'ES256' && typeof row.boundAt === 'string' && Number.isFinite(Date.parse(row.boundAt));
}
