import type { View } from '../types';
import { isSystemView } from './viewNavigation';

/** Options the installer turned on or off for this installation. */
export interface InstalledFeatures {
  homeChat: boolean;
  /** Local voice: microphone, wake word and spoken answers. Always off when the chat is off. */
  voice: boolean;
}

/** Until the installation answers, every option is assumed present so nothing flickers away. */
export const DEFAULT_INSTALLED_FEATURES: InstalledFeatures = { homeChat: true, voice: true };

/**
 * A view the installation does not include, or the system area (and the assistant insights page) for a role
 * that cannot use it, is shown as the home dashboard. `canAccessSystem` is only enforced once the role is known.
 */
export function resolveVisibleView(view: View, features: InstalledFeatures, canAccessSystem = true): View {
  if (view === 'home-conversation' && !features.homeChat) return 'dashboard';
  if ((isSystemView(view) || view === 'assistant') && !canAccessSystem) return 'dashboard';
  return view;
}
