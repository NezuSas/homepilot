import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './ui/IconButton';

interface MobileSidebarToggleProps {
  onOpen: () => void;
}

export function MobileSidebarToggle({ onOpen }: MobileSidebarToggleProps) {
  const { t } = useTranslation();

  return (
    <IconButton
      icon={Menu}
      label={t('shell.toggle_sidebar')}
      variant="default"
      size="lg"
      onClick={onOpen}
      className="fixed left-3 top-3 z-[35] h-10 w-10 rounded-xl border-border/70 bg-card/90 text-muted-foreground shadow-depth-1 backdrop-blur-md hover:text-foreground xl:hidden"
    />
  );
}
