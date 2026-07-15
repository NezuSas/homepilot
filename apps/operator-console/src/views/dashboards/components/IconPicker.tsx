import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { CircleHelp } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

type IconComponent = ComponentType<{ className?: string }>;

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
    .replace(/^lucide[-_\s]*/i, '')
    .replace(/[-_\s]+(.)/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/Icon$/i, '')
    .toLowerCase();
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

const ICONS = Object.entries(LucideIcons)
  .filter(([name, value]) => isRenderableLucideExport(name, value))
  .map(([name, component]) => ({
    name,
    icon: component as IconComponent,
    normalized: normalizeIconName(name),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getLucideIconComponent(value?: string): IconComponent {
  const normalized = normalizeIconName(value || '');
  if (!normalized) return CircleHelp;

  return (
    ICONS.find((item) => item.normalized === normalized)?.icon ||
    ICONS.find((item) => item.name.toLowerCase() === (value || '').trim().toLowerCase())?.icon ||
    ICONS.find((item) => item.normalized.includes(normalized))?.icon ||
    CircleHelp
  );
}

export function IconPicker({
  value = '',
  onChange,
  placeholder = 'Ej: Lightbulb, Power, Tv, Cat, Dog',
  label = 'Icono (opcional)',
  className,
}: IconPickerProps) {
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconQuery, setIconQuery] = useState(value);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    setIconQuery(value);
  }, [value]);

  const SelectedIcon = getLucideIconComponent(iconQuery);

  const filteredIcons = useMemo(() => {
    const q = normalizeIconName(iconQuery);

    if (!q) return ICONS.slice(0, 120);

    const startsWith = ICONS.filter((item) => item.normalized.startsWith(q));
    const includes = ICONS.filter((item) => !item.normalized.startsWith(q) && item.normalized.includes(q));

    return [...startsWith, ...includes].slice(0, 120);
  }, [iconQuery]);

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
              No se encontraron iconos.
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <span className="text-caption font-black uppercase tracking-label text-muted-foreground">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <input
          ref={iconInputRef}
          type="text"
          className="h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-3 text-body text-foreground transition-colors focus:border-primary/50 focus:outline-none"
          placeholder={placeholder}
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
