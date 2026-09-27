import type { AndroidDisplayMetadata } from '../domain/AndroidDisplaySource';

export type BridgeConnectionState = 'online' | 'offline' | 'needs_authorization';
export type BridgeAction = 'navigate_home' | 'navigate_back' | 'volume_set';

export interface AndroidDisplayBridgePort {
  connect(sourceId: string, host: string, port: 5555): Promise<BridgeConnectionState>;
  state(sourceId: string): Promise<BridgeConnectionState>;
  inspect(sourceId: string): Promise<AndroidDisplayMetadata>;
  execute(sourceId: string, action: BridgeAction, params: Record<string, unknown>): Promise<void>;
  disconnect(sourceId: string): Promise<void>;
}

export class AndroidDisplayBridgeError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AndroidDisplayBridgeError';
  }
}
