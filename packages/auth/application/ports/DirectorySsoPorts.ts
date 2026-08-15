export interface DirectoryAccountLink {
  directoryAccountId: string;
  localUserId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface DirectoryLinkRepository {
  findByDirectoryAccountId(directoryAccountId: string): Promise<DirectoryAccountLink | null>;
  create(directoryAccountId: string, localUserId: string): Promise<void>;
  delete(directoryAccountId: string, localUserId: string): Promise<boolean>;
  listByLocalUserId(localUserId: string): Promise<DirectoryAccountLink[]>;
  linkAndConsume(directoryAccountId: string, localUserId: string, jti: string, expiresAt: string): Promise<void>;
}

export interface UsedSsoTokenRepository {
  isUsed(jti: string): Promise<boolean>;
  markUsed(jti: string, expiresAt: string): Promise<void>;
  purgeExpired(): Promise<void>;
}