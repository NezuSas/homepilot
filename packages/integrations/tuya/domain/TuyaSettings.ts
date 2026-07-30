export interface TuyaSettings {
  readonly endpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly userUid: string;
  readonly updatedAt: string;
}

export interface TuyaConnectionStatus {
  readonly configured: boolean;
  readonly endpoint: string;
  readonly clientIdHint: string;
  readonly userUidHint: string;
  readonly updatedAt: string | null;
}