import { useUserFavorites } from './useUserFavorites';

export function useSceneFavorites(userId: string | null, sceneIds: string[]) {
  return useUserFavorites(userId, sceneIds, 'scene');
}

export function useAutomationFavorites(userId: string | null, automationIds: string[]) {
  return useUserFavorites(userId, automationIds, 'automation');
}
