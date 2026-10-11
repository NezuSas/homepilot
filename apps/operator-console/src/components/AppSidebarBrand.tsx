import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';

interface AppSidebarBrandProps {
  collapsed: boolean;
  title: string;
  toggleLabel: string;
  onToggle: () => void;
}

/** Brand and desktop sidebar toggle. */
export function AppSidebarBrand({ collapsed, title, toggleLabel, onToggle }: AppSidebarBrandProps) {
  return (
    <div className={cn('border-b border-border/40 px-4 py-3 shrink-0 transition-all duration-300', collapsed && 'xl:px-3')}>
      <div className={cn('flex items-center gap-2.5', collapsed && 'xl:justify-center')}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="flex shrink-0 items-center justify-center overflow-hidden transition-opacity hover:opacity-75"
          title={toggleLabel}
          aria-label={toggleLabel}
        >
          <img src="/logo.svg" alt="HomePilot" className={cn('h-7 w-auto object-contain transition-opacity', !collapsed && 'xl:opacity-100')} />
        </Button>
        <Heading variant="section" as="h2" className={cn('leading-none whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200', collapsed && 'xl:w-0 xl:opacity-0')}>
          {title}
        </Heading>
      </div>
    </div>
  );
}
