import { useEffect, useState } from 'react';

export const DASHBOARD_SKELETON_DELAY_MS = 190;

export function needsInitialDashboardSkeleton(isLoading: boolean, hasKnownContent: boolean): boolean {
  return isLoading && !hasKnownContent;
}

/** The delay belongs to the loading boundary, never to individual placeholder bars. */
export function useDelayedSkeleton(pending: boolean): boolean {
  const [state, setState] = useState({ pending, visible: false });

  useEffect(() => {
    if (!pending) {
      setState({ pending: false, visible: false });
      return;
    }

    setState({ pending: true, visible: false });
    const timer = window.setTimeout(() => setState({ pending: true, visible: true }), DASHBOARD_SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return pending && state.pending && state.visible;
}
