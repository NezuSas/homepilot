import type { UserContext } from '../lib/useSession';
import type { GlobalWakeNoticeModel, GlobalWakeStatus } from './GlobalWakeNotice';
import { ChangePasswordModal } from '../views/ChangePasswordModal';
import { DemoGuideOverlay } from './DemoGuideOverlay';
import { GlobalWakeListener } from './GlobalWakeListener';
import { GlobalWakeNotice } from './GlobalWakeNotice';
import { UserProfileModal } from './UserProfileModal';
import type { View } from '../types';
import { isGlobalWakeListenerEnabled } from './appShellBoundaryHelpers';

export { isGlobalWakeListenerEnabled } from './appShellBoundaryHelpers';

interface AppGlobalOverlaysProps {
  authenticated: boolean;
  loadingSetup: boolean;
  requiresOnboarding: boolean;
  showPasswordModal: boolean;
  showProfileModal: boolean;
  user: UserContext | null;
  globalWakeNotice: GlobalWakeNoticeModel | null;
  isGlobalWakeProcessing: boolean;
  isGlobalWakeSpeaking: boolean;
  onNavigate: (view: View) => void;
  onClosePasswordModal: () => void;
  onPasswordChanged: () => void;
  onCloseProfileModal: () => void;
  onProfileSaved: (profile: { displayName: string | null; avatarDataUri: string | null }) => void;
  onWakeCommand: (command: string) => void;
  onWakeInterrupt: () => void;
  onWakeStatusChange: (status: GlobalWakeStatus) => void;
}

export function AppGlobalOverlays(props: AppGlobalOverlaysProps) {
  return <>
    <ChangePasswordModal isOpen={props.showPasswordModal} onClose={props.onClosePasswordModal} onSuccess={props.onPasswordChanged} />
    <DemoGuideOverlay onNavigate={props.onNavigate} />
    {props.globalWakeNotice && <GlobalWakeNotice notice={props.globalWakeNotice} isProcessing={props.isGlobalWakeProcessing} />}
    <GlobalWakeListener enabled={isGlobalWakeListenerEnabled(props.authenticated, props.loadingSetup, props.requiresOnboarding)} interruptOnly={props.isGlobalWakeProcessing || props.isGlobalWakeSpeaking} onCommand={props.onWakeCommand} onWakeInterrupt={props.onWakeInterrupt} onStatusChange={props.onWakeStatusChange} />
    {props.showProfileModal && props.user && <UserProfileModal user={props.user} onClose={props.onCloseProfileModal} onSaved={props.onProfileSaved} />}
  </>;
}
