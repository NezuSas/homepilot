import type { PointerEvent, ReactNode } from 'react';
import { getAppSidebarShellClassName } from './appShellBoundaryHelpers';

export { getAppSidebarShellClassName } from './appShellBoundaryHelpers';

interface AppSidebarShellProps {
  isOpen: boolean;
  isDesktopOpen: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  children: ReactNode;
}

export function AppSidebarShell({ isOpen, isDesktopOpen, onPointerDown, onPointerUp, onPointerCancel, children }: AppSidebarShellProps) {
  return <aside className={getAppSidebarShellClassName(isOpen, isDesktopOpen)} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>{children}</aside>;
}
