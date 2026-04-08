export interface SystemSetupState {
  id: string; // Fijo 'local-edge'
  isInitialized: boolean;
  initializedAt: string | null;
  setupVersion: number;
  onboardingCompletedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSetupRepository {
  getSetupState(): Promise<SystemSetupState>;
  markAsInitialized(userId: string): Promise<SystemSetupState>;
}
