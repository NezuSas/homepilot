interface MobileSidebarBackdropProps {
  onDismiss: () => void;
}

export function MobileSidebarBackdrop({ onDismiss }: MobileSidebarBackdropProps) {
  return <div className="fixed inset-0 z-[40] bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 xl:hidden" data-testid="mobile-sidebar-backdrop" aria-hidden="true" onClick={onDismiss} />;
}
