export const SCENE_FAVORITES_STORAGE_KEY = 'hp_fav_scenes';
export const AUTOMATION_FAVORITES_STORAGE_KEY = 'hp_fav_automations';

export const readFavoriteIds = (storageKey: string): string[] => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

export const writeFavoriteIds = (storageKey: string, ids: string[]): void => {
  localStorage.setItem(storageKey, JSON.stringify(ids));
};
