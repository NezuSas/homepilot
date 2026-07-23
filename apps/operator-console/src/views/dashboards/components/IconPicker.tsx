import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

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

const LUCIDE_ICONS: IconEntry[] = Object.entries(LucideIcons)
  .filter(([name, value]) => isRenderableLucideExport(name, value))
  .map(([name, component]) => ({
    name,
    icon: component as IconComponent,
    normalized: normalizeIconName(name),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function mdiExportNameToIconName(exportName: string): string | null {
  if (!exportName.startsWith('mdi') || exportName.length <= 3) return null;

  const rest = exportName.slice(3);
  if (!/^[A-Z0-9]/.test(rest)) return null;

  return `mdi:${rest
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()}`;
}

let mdiCatalog: IconEntry[] = [];
let mdiCatalogPromise: Promise<void> | null = null;

function loadMdiCatalog(): Promise<void> {
  if (mdiCatalogPromise) return mdiCatalogPromise;

  mdiCatalogPromise = import('@mdi/js').then((module) => {
    mdiCatalog = Object.entries(module)
      .map(([exportName, path]) => {
        const name = mdiExportNameToIconName(exportName);
        if (!name || typeof path !== 'string') return null;

        return { name, icon: createMdiIcon(path), normalized: normalizeIconName(name) };
      })
      .filter((entry): entry is IconEntry => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  return mdiCatalogPromise;
}

/** Loads the complete Home Assistant-compatible MDI catalog once per session. */
export function useMdiCatalogLoaded(): boolean {
  const [isLoaded, setIsLoaded] = useState(mdiCatalog.length > 0);

  useEffect(() => {
    let active = true;

    void loadMdiCatalog().then(() => {
      if (active) setIsLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  return isLoaded;
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
  useMdiCatalogLoaded();

  useEffect(() => {
    setIconQuery(value);
  }, [value]);

  const SelectedIcon = getDashboardIconComponent(iconQuery);
  const resolvedPlaceholder = placeholder ?? t('dashboard.editor.sections.icon_picker_placeholder');
  const resolvedLabel = label ?? t('dashboard.editor.sections.icon_picker_label');

  const iconCatalog = getIconCatalog();

  const filteredIcons = useMemo(() => {
    const icons = iconCatalog;
    const q = normalizeIconName(iconQuery);

    if (!q) return icons.slice(0, 120);

    const startsWith = icons.filter((item) => item.normalized.startsWith(q));
    const includes = icons.filter((item) => !item.normalized.startsWith(q) && item.normalized.includes(q));

    return [...startsWith, ...includes].slice(0, 120);
  }, [iconCatalog, iconQuery]);

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
                <Button
                  key={item.name}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIconQuery(item.name);
                    onChange(item.name);
                    setDropdownPos(null);
                  }}
                  className={cn(
                    'w-full justify-start gap-3 rounded-xl px-3 text-left text-body font-black',
                    selected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Button>
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
      <Input
        ref={iconInputRef}
        type="text"
        label={resolvedLabel}
        placeholder={resolvedPlaceholder}
        value={iconQuery}
        icon={<SelectedIcon className="h-5 w-5" />}
        onFocus={computeDropdownPos}
        onChange={(event) => {
          const val = event.target.value;
          setIconQuery(val);
          onChange(val);
          setTimeout(computeDropdownPos, 0);
        }}
        onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
        className="border-border/60 bg-card text-foreground"
      />

      {dropdown}
    </div>
  );
}
