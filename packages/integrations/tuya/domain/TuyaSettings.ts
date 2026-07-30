export interface TuyaAuthorization {
  readonly userCode: string;
  readonly endpoint: string;
  readonly uid: string;
  readonly terminalId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly updatedAt: string;
}

export interface TuyaConnectionStatus {
  readonly available: boolean;
  readonly configured: boolean;
  readonly userCodeHint: string;
  readonly updatedAt: string | null;
}

export interface TuyaAuthorizationSession {
  readonly qrToken: string;
  readonly qrCode: string;
  readonly expiresAt: number | null;
}