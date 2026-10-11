import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { getDashboardBackgroundSource } from '../../lib/dashboardBackgroundPresets';
import type { DashboardTab } from './types';

/**
 * Resolves the background of the active tab. The previous loaded image stays
 * while the next one decodes; a tab without a background clears immediately
 * instead of showing the previous tab's art.
 */
export function useDashboardBackground(activeTab: DashboardTab | undefined) {
  const [loadedBackground, setLoadedBackground] = useState<{ source: string; opacity: number } | null>(null);
  const backgroundSource = activeTab?.background
    ? getDashboardBackgroundSource(activeTab.background, API_BASE_URL)
    : null;
  const backgroundOpacity = (activeTab?.backgroundOpacity ?? 100) / 100;

  useEffect(() => {
    if (!backgroundSource) {
      setLoadedBackground(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setLoadedBackground({ source: backgroundSource, opacity: backgroundOpacity });
    };
    image.onerror = () => {
      if (!cancelled) setLoadedBackground(null);
    };
    image.src = backgroundSource;
    return () => { cancelled = true; };
  }, [backgroundSource, backgroundOpacity]);

  return backgroundSource ? loadedBackground : null;
}
