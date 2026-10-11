import type { View } from '../types';

/** Options the installer turned on or off for this installation. */
export interface InstalledFeatures {
  homeChat: boolean;
}

/** Until the installation answers, every option is assumed present so nothing flickers away. */
export const DEFAULT_INSTALLED_FEATURES: InstalledFeatures = { homeChat: true };

/** A view the installation does not include is shown as the home dashboard. */
export function resolveVisibleView(view: View, features: InstalledFeatures): View {
  return view === 'home-conversation' && !features.homeChat ? 'dashboard' : view;
}
