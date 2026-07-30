import { TuyaAuthorization } from './TuyaSettings';

export interface TuyaSettingsRepository {
  getAuthorization(): Promise<TuyaAuthorization | null>;
  saveAuthorization(authorization: TuyaAuthorization): Promise<void>;
  clearAuthorization(): Promise<void>;
}