import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  chooseDashboardIcon, DashboardMdiIcon, getDashboardIconComponent,
  getLoadedDashboardMdiCatalog, isDashboardIconAvailable, limitDashboardMdiIcons,
  loadDashboardMdiCatalog, searchDashboardMdiIcons, type DashboardMdiCatalog,
} from './dashboardIconRegistry';

export { getDashboardIconComponent } from './dashboardIconRegistry';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

const INITIAL_ICON_COUNT = 60;
const ICON_PAGE_SIZE = 60;
export const MAX_RENDERED_ICONS = 240;

export function IconPicker({ value = '', onChange, placeholder, label, className }: IconPickerProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_ICON_COUNT);
  const [catalog, setCatalog] = useState<DashboardMdiCatalog | null>(getLoadedDashboardMdiCatalog);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const SelectedIcon = getDashboardIconComponent(value);
  const resolvedLabel = label ?? t('dashboard.editor.sections.icon_picker_label');
  const selectedExists = isDashboardIconAvailable(value, catalog);
  const filteredIcons = useMemo(() => catalog ? searchDashboardMdiIcons(deferredQuery, catalog) : [], [catalog, deferredQuery]);
  const visibleIcons = useMemo(() => limitDashboardMdiIcons(filteredIcons, value, visibleLimit), [filteredIcons, value, visibleLimit]);

  useEffect(() => {
    if (catalog || !value.startsWith('mdi:') || isDashboardIconAvailable(value, catalog) !== null) return;
    let active = true;
    void loadDashboardMdiCatalog().then((loaded) => { if (active) setCatalog(loaded); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [value, catalog]);

  useEffect(() => {
    if (!open || catalog) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    void loadDashboardMdiCatalog().then((loaded) => {
      if (active) setCatalog(loaded);
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, catalog, loadAttempt]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const visual = window.visualViewport;
      const viewportTop = visual?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (visual?.height ?? window.innerHeight);
      const width = Math.min(560, window.innerWidth - 24);
      const below = viewportBottom - rect.bottom - 12;
      const above = rect.top - viewportTop - 12;
      const opensBelow = below >= 320 || below >= above;
      const useFullViewport = Math.max(below, above) < 180;
      const maxHeight = Math.max(0, Math.min(520, useFullViewport
        ? viewportBottom - viewportTop - 24 : opensBelow ? below : above));
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: useFullViewport ? viewportTop + 12
          : opensBelow ? rect.bottom + 8 : Math.max(viewportTop + 12, rect.top - maxHeight - 8),
        width,
        maxHeight,
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
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
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
      role="dialog"
      aria-label={resolvedLabel}
      className="fixed z-[100000] flex flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
      style={position}
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-popover px-4 pb-3 pt-4">
        <Input
          ref={searchRef}
          type="search"
          aria-label={t('dashboard.editor.sections.icon_picker_search')}
          placeholder={placeholder ?? t('dashboard.editor.sections.icon_picker_search')}
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setVisibleLimit(INITIAL_ICON_COUNT); }}
        />
        {catalog && <p className="mt-2 text-xs text-muted-foreground">
          {t('dashboard.editor.sections.icon_picker_count', { count: filteredIcons.length })}
        </p>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{t('dashboard.editor.sections.icon_picker_loading')}
          </p>
        ) : loadError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('dashboard.editor.sections.icon_picker_load_error')}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLoadAttempt((n) => n + 1)}>
              {t('dashboard.editor.sections.icon_picker_retry')}
            </Button>
          </div>
        ) : visibleIcons.length ? (
          <div role="listbox" aria-label={resolvedLabel} className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6">
            {visibleIcons.map(({ name, path }) => (
              <Button
                key={name}
                type="button"
                variant="ghost"
                role="option"
                aria-selected={name === value}
                title={name}
                onClick={() => {
                  chooseDashboardIcon(name, onChange, catalog);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cn(
                  'min-h-20 min-w-0 flex-col gap-2 rounded-xl px-1 py-2 hover:bg-muted/70',
                  name === value && 'bg-primary/15 text-primary ring-2 ring-primary/50',
                )}
              >
                <DashboardMdiIcon path={path} className="h-7 w-7 shrink-0" />
                <span className="max-w-full truncate text-micro font-medium">{name.slice(4)}</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-muted-foreground">
            <Search className="h-7 w-7" aria-hidden="true" />
            <p className="text-sm font-semibold">{t('dashboard.editor.sections.icon_picker_empty')}</p>
          </div>
        )}
        {!loading && !loadError && visibleLimit < filteredIcons.length && visibleLimit < MAX_RENDERED_ICONS && (
          <Button type="button" variant="ghost" size="sm" className="mt-4 w-full"
            onClick={() => setVisibleLimit((count) => Math.min(MAX_RENDERED_ICONS, count + ICON_PAGE_SIZE))}>
            {t('dashboard.editor.sections.icon_picker_more', {
              count: Math.min(ICON_PAGE_SIZE, MAX_RENDERED_ICONS - visibleLimit, filteredIcons.length - visibleLimit),
            })}
          </Button>
        )}
        {!loading && !loadError && visibleLimit >= MAX_RENDERED_ICONS && filteredIcons.length > MAX_RENDERED_ICONS && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('dashboard.editor.sections.icon_picker_refine')}
          </p>
        )}
      </div>
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
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      onClick={() => { setQuery(''); setVisibleLimit(INITIAL_ICON_COUNT); setOpen((current) => !current); }}
      className="w-full justify-start rounded-xl bg-card text-left"
    >
      <SelectedIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{value || resolvedLabel}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
    {value && selectedExists === false && (
      <p className="ml-1 text-sm text-muted-foreground" role="status">
        {t('dashboard.editor.sections.icon_picker_unavailable', { icon: value })}
      </p>
    )}
    {popup}
  </div>;
}
