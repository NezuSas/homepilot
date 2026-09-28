import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  chooseDashboardIcon, getDashboardIconComponent, isDashboardIconAvailable,
  searchDashboardIcons,
} from './dashboardIconRegistry';

export { getDashboardIconComponent } from './dashboardIconRegistry';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

const INITIAL_ICON_COUNT = 48;

export function IconPicker({ value = '', onChange, placeholder, label, className }: IconPickerProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const selectedExists = isDashboardIconAvailable(value);
  const SelectedIcon = getDashboardIconComponent(value);
  const resolvedLabel = label ?? t('dashboard.editor.sections.icon_picker_label');
  const filteredIcons = useMemo(() => searchDashboardIcons(query), [query]);
  const visibleIcons = showAll ? filteredIcons : filteredIcons.slice(0, INITIAL_ICON_COUNT);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 320)),
        width,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && position && document.activeElement === triggerRef.current) searchRef.current?.focus();
  }, [open, position]);

  const popup = open && position && typeof document !== 'undefined' ? createPortal(
    <div
      ref={popupRef}
      id={listboxId}
      className="fixed z-[100000] max-h-[min(24rem,calc(100vh-24px))] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-3 shadow-2xl"
      style={position}
    >
      <Input
        ref={searchRef}
        type="search"
        aria-label={t('dashboard.editor.sections.icon_picker_search')}
        placeholder={placeholder ?? t('dashboard.editor.sections.icon_picker_search')}
        icon={<Search className="h-4 w-4" />}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setShowAll(false); }}
      />
      {visibleIcons.length ? (
        <div role="listbox" aria-label={resolvedLabel} className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-4">
          {visibleIcons.map(({ name, icon: Icon }) => (
            <Button
              key={name}
              type="button"
              variant="ghost"
              size="sm"
              role="option"
              aria-selected={name === value}
              title={name}
              onClick={() => {
                chooseDashboardIcon(name, onChange);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn('min-h-16 min-w-0 flex-col gap-1 rounded-xl px-1 py-2', name === value && 'bg-primary/15 text-primary')}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate text-xs font-medium">{name}</span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.editor.sections.icon_picker_empty')}
        </p>
      )}
      {!showAll && filteredIcons.length > INITIAL_ICON_COUNT && (
        <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll(true)}>
          {t('dashboard.editor.sections.icon_picker_more', { count: filteredIcons.length - INITIAL_ICON_COUNT })}
        </Button>
      )}
    </div>, document.body) : null;

  return <div className={cn('space-y-2', className)}>
    <span id={`${listboxId}-label`} className="ml-1 block text-micro font-black uppercase tracking-widest text-muted-foreground">
      {resolvedLabel}
    </span>
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      aria-labelledby={`${listboxId}-label`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      onClick={() => { setQuery(''); setShowAll(false); setOpen((current) => !current); }}
      className="w-full justify-start rounded-xl bg-card text-left"
    >
      <SelectedIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{value || resolvedLabel}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
    {value && !selectedExists && (
      <p className="ml-1 text-sm text-muted-foreground" role="status">
        {t('dashboard.editor.sections.icon_picker_unavailable', { icon: value })}
      </p>
    )}
    {popup}
  </div>;
}
