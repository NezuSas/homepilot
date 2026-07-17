import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

type IconComponent = ComponentType<{ className?: string }>;

interface IconEntry {
  name: string;
  icon: IconComponent;
  normalized: string;
}

const BLOCKED_EXPORTS = new Set([
  'default',
  'icons',
  'createLucideIcon',
  'Icon',
  'LucideIcon',
  'LucideProps',
]);

function normalizeIconName(value: string) {
  return value
    .trim()
    .replace(/^(lucide|mdi)[:\-_\s]*/i, '')
    .replace(/[-_\s]+(.)/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/Icon$/i, '')
    .toLowerCase();
}

function createMdiIcon(path: string): IconComponent {
  return function MdiIcon({ className }) {
    return (
      <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d={path} />
      </svg>
    );
  };
}

function isRenderableLucideExport(name: string, value: unknown) {
  if (BLOCKED_EXPORTS.has(name)) return false;
  if (!/^[A-Z0-9]/.test(name)) return false;

  // lucide-react exports icons as React components. Depending on React/build,
  // they can be functions or forwardRef-like objects. Exclude plain objects.
  if (typeof value === 'function') return true;

  if (value && typeof value === 'object') {
    const record = value as Record<string | symbol, unknown>;
    const reactType = record[Symbol.for('react.forward_ref')] || record.$$typeof;
    return Boolean(reactType);
  }

  return false;
}

/**
 * Converts an `@mdi/js` export name (e.g. `mdiCeilingLightMultiple`) into the
 * `mdi:kebab-case` icon key used throughout the dashboard (e.g.
 * `mdi:ceiling-light-multiple`).
 */
function mdiExportNameToIconName(exportName: string): string | null {
  if (!exportName.startsWith('mdi') || exportName.length <= 3) return null;
  const rest = exportName.slice(3);
  if (!/^[A-Z0-9]/.test(rest)) return null;

  const kebab = rest
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  return `mdi:${kebab}`;
}

const LUCIDE_ICONS: IconEntry[] = Object.entries(LucideIcons)
  .filter(([name, value]) => isRenderableLucideExport(name, value))
  .map(([name, component]) => ({
    name,
    icon: component as IconComponent,
    normalized: normalizeIconName(name),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// The full Home Assistant Material Design Icons set (~7000 entries) is loaded
// lazily via a dynamic import instead of a static `import * as MdiIcons from
// '@mdi/js'`. A static import would bundle the whole set into every route
// that renders a dashboard card, inflating that chunk by ~800KB gzipped just
// to resolve icon names. The dynamic import lets the bundler split it into
// its own chunk, fetched once (cached) in parallel with the rest of the app
// instead of blocking/bloating the main dashboard chunk.
let mdiCatalog: IconEntry[] = [];
let mdiCatalogLoaded = false;
let mdiCatalogPromise: Promise<void> | null = null;
const mdiCatalogListeners = new Set<() => void>();

function loadMdiCatalog(): Promise<void> {
  if (mdiCatalogPromise) return mdiCatalogPromise;

  mdiCatalogPromise = import('@mdi/js').then((mod) => {
    mdiCatalog = Object.entries(mod)
      .map(([exportName, path]) => {
        const name = mdiExportNameToIconName(exportName);
        if (!name || typeof path !== 'string') return null;
        return { name, icon: createMdiIcon(path), normalized: normalizeIconName(name) };
      })
      .filter((entry): entry is IconEntry => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    mdiCatalogLoaded = true;
    mdiCatalogListeners.forEach((listener) => listener());
  });

  return mdiCatalogPromise;
}

// Kick off the lazy load as soon as any icon-consuming module runs. This is
// still "immediate", but as a separate async chunk it doesn't block parsing
// or first paint of the dashboard route the way the static import did.
void loadMdiCatalog();

function subscribeToMdiCatalog(listener: () => void): () => void {
  mdiCatalogListeners.add(listener);
  return () => mdiCatalogListeners.delete(listener);
}

function getMdiCatalogSnapshot(): boolean {
  return mdiCatalogLoaded;
}

/** Forces a re-render once the lazily-loaded MDI catalog resolves. */
export function useMdiCatalogLoaded(): boolean {
  return useSyncExternalStore(subscribeToMdiCatalog, getMdiCatalogSnapshot, () => false);
}

function getIconCatalog(): IconEntry[] {
  return [...mdiCatalog, ...LUCIDE_ICONS];
}

export function getDashboardIconComponent(value?: string): IconComponent {
  const normalized = normalizeIconName(value || '');
  if (!normalized) return CircleHelp;

  const icons = getIconCatalog();
  return (
    icons.find((item) => item.normalized === normalized)?.icon ||
    icons.find((item) => item.name.toLowerCase() === (value || '').trim().toLowerCase())?.icon ||
    icons.find((item) => item.normalized.includes(normalized))?.icon ||
    CircleHelp
  );
}

export function IconPicker({
  value = '',
  onChange,
  placeholder,
  label,
  className,
}: IconPickerProps) {
  const { t } = useTranslation();
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconQuery, setIconQuery] = useState(value);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);
  // Re-renders once the lazily-loaded MDI catalog resolves, so the picker
  // (opened during editing) picks up the full set instead of just Lucide.
  const mdiLoaded = useMdiCatalogLoaded();

  useEffect(() => {
    setIconQuery(value);
  }, [value]);

  const SelectedIcon = getDashboardIconComponent(iconQuery);
  const resolvedPlaceholder = placeholder ?? t('dashboard.editor.sections.icon_picker_placeholder');
  const resolvedLabel = label ?? t('dashboard.editor.sections.icon_picker_label');

  const filteredIcons = useMemo(() => {
    const icons = getIconCatalog();
    const q = normalizeIconName(iconQuery);

    if (!q) return icons.slice(0, 120);

    const startsWith = icons.filter((item) => item.normalized.startsWith(q));
    const includes = icons.filter((item) => !item.normalized.startsWith(q) && item.normalized.includes(q));

    return [...startsWith, ...includes].slice(0, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mdiLoaded triggers a recompute once the lazy catalog resolves
  }, [iconQuery, mdiLoaded]);

  const computeDropdownPos = () => {
    const rect = iconInputRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownPos({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!dropdownPos) return;

    const updatePosition = () => computeDropdownPos();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dropdownPos]);

  const dropdown = dropdownPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed z-[100000] max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-popover p-2 shadow-2xl"
          style={{
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
          }}
        >
          {filteredIcons.length > 0 ? (
            filteredIcons.map((item) => {
              const Icon = item.icon;
              const selected = item.normalized === normalizeIconName(iconQuery);

              return (
                <button
                  key={item.name}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIconQuery(item.name);
                    onChange(item.name);
                    setDropdownPos(null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-body font-black transition',
                    selected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-body font-semibold text-muted-foreground">
              {t('dashboard.editor.sections.icon_picker_empty')}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {resolvedLabel ? (
        <span className="text-caption font-black uppercase tracking-label text-muted-foreground">
          {resolvedLabel}
        </span>
      ) : null}

      <div className="relative">
        <input
          ref={iconInputRef}
          type="text"
          className="h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-3 text-body text-foreground transition-colors focus:border-primary/50 focus:outline-none"
          placeholder={resolvedPlaceholder}
          value={iconQuery}
          onFocus={computeDropdownPos}
          onChange={(event) => {
            const val = event.target.value;
            setIconQuery(val);
            onChange(val);
            setTimeout(computeDropdownPos, 0);
          }}
          onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
        />

        <SelectedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {dropdown}
    </div>
  );
}
